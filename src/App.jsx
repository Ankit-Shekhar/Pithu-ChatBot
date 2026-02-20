import { useState, useEffect } from 'react'
import './App.css'
import axios from 'axios';



function App() {
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [abortController, setAbortController] = useState(null)
  const [printingAborted, setPrintingAborted] = useState(false)
  const [lastRequestTime, setLastRequestTime] = useState(0)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Load dark mode preference from localStorage on component mount
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setIsDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.body.classList.add('dark-mode');
    }
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode.toString());
    
    if (newDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  };

  async function generateAnswer() {
    if (isRateLimited) {
      setAnswer('Rate limit exceeded. Please wait a moment and try again.');
      return;
    }

    // Rate limiting - prevent requests too close together
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    const minInterval = 3000; // 3 seconds minimum between requests
    
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      setAnswer(`Please wait ${Math.ceil(waitTime / 1000)} seconds before trying again.`);
      showLoadingMessage();
      setTimeout(() => {
        removeLoadingMessage();
        setAnswer("");
      }, waitTime);
      return;
    }
    
    setLastRequestTime(now);
    setIsLoading(true)
    setPrintingAborted(false)
    setAnswer("loading...")
    
    // Show loading message immediately
    showLoadingMessage();
    
    // Create abort controller for canceling requests
    const controller = new AbortController();
    setAbortController(controller);
    
    try {
      // Use Netlify function instead of direct API call for security
      const response = await axios({
        url: '/.netlify/functions/chat',
        method: "POST",
        data: { question },
        timeout: 30000, // 30 second timeout
        signal: controller.signal, // Add abort signal
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response?.data?.success && response?.data?.response) {
        const responseText = response.data.response;
        setAnswer(responseText);
      } else {
        console.error('Invalid response structure:', response);
        setAnswer("Sorry, I received an invalid response. Please try again.");
        setIsLoading(false);
        setAbortController(null);
        showRetryButton();
        return;
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
        setAnswer("Request cancelled by user.");
      } else {
        console.error('Full error object:', error);
        console.error('Error response:', error.response);
        console.error('Error status:', error.response?.status);
        console.error('Error data:', error.response?.data);
        
        const serverDetailsRaw = error.response?.data?.details;
        const serverDetails =
          typeof serverDetailsRaw === 'string'
            ? serverDetailsRaw
            : serverDetailsRaw
              ? JSON.stringify(serverDetailsRaw)
              : undefined;
        let errorMessage = "Sorry, I encountered an error. Please try again.";
        if (error.response?.status === 400) {
          errorMessage = "Invalid request. Please check your message and try again.";
        } else if (error.response?.status === 403) {
          errorMessage = serverDetails
            ? `AI service rejected the request: ${serverDetails}`
            : "Access to the AI service was denied (403). Check your token, permissions, and model availability.";
        } else if (error.response?.status === 429) {
            const retryAfterSecondsRaw = error.response?.data?.retryAfterSeconds;
            const retryAfterSeconds =
              typeof retryAfterSecondsRaw === 'number'
                ? retryAfterSecondsRaw
                : retryAfterSecondsRaw
                  ? Number(retryAfterSecondsRaw)
                  : undefined;

            const waitSeconds = Number.isFinite(retryAfterSeconds)
              ? Math.max(1, Math.ceil(retryAfterSeconds))
              : 30;

            errorMessage = `Rate limit exceeded. Please try again in ${waitSeconds} seconds.`;
            setIsRateLimited(true);
            setTimeout(() => {
              setIsRateLimited(false);
            }, waitSeconds * 1000);
        } else if (error.response?.status >= 500) {
          errorMessage = "Server error. Please try again later.";
        }
        
        setAnswer(errorMessage);
        showRetryButton();
      }
      setIsLoading(false);
      setAbortController(null);
      return;
    }
    // isLoading will be set to false by the typewriter effect when complete
  }

  // Use useEffect to handle reply when answer changes
  useEffect(() => {
    if (answer && answer !== "loading..." && isLoading && !printingAborted) {
      // Remove loading message before showing actual reply
      removeLoadingMessage();
      setIsPrinting(true);
      reply()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer, isLoading, printingAborted]) // reply is intentionally omitted as it's a stable function

  function toggleChatbot() {
    const chatbotBody = document.querySelector(".chatbotBody");
    if (chatbotBody.classList.contains('open')) {
      chatbotBody.classList.remove('open');
      setTimeout(() => { chatbotBody.style.display = 'none'; }, 500);
    } else {
      chatbotBody.style.display = 'block';
      setTimeout(() => { chatbotBody.classList.add('open'); }, 10);
    }
  }

  function sendMessage() {
    const chatBody = document.getElementById('main');
    if (!chatBody) return; // Safety check
    
    const message = question.trim(); // Use React state instead of DOM value
    if (message) {
      const userMessageElement = document.createElement('div');
      userMessageElement.className = 'message user-message';
      userMessageElement.textContent = message;
      
      // Add timestamp
      addTimestamp(userMessageElement);
      
      chatBody.append(userMessageElement);

      const spacer = document.createElement('div');
      spacer.style.height = '1em'; // adding space b/w 2 msgs
      chatBody.append(spacer);

      chatBody.scrollTop = chatBody.scrollHeight;
    }
  }

  function reply() {
    const repo = document.createElement('div')
    const resBody = document.getElementById('main');
    if (!resBody) return; // Safety check
    
    // Clean and format the answer text
    let cleanAnswer = answer.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    
    // Handle markdown-style formatting
    // Convert **text** to bold
    cleanAnswer = cleanAnswer.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert *text* to italic
    cleanAnswer = cleanAnswer.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Convert line breaks to proper HTML breaks
    cleanAnswer = cleanAnswer.replace(/\n/g, '<br>');
    
    // Handle bullet points and lists
    cleanAnswer = cleanAnswer.replace(/^\* /gm, '• ');
    cleanAnswer = cleanAnswer.replace(/^- /gm, '• ');
    
    repo.setAttribute("class", "bot-response")
    
    // Add timestamp
    addTimestamp(repo);
    
    resBody.append(repo)

    // Add typing animation effect
    typewriterEffect(cleanAnswer, repo);

    const spacer = document.createElement('div');
    spacer.style.height = '1em'; // adding space b/w 2 msgs
    resBody.append(spacer);

    // Auto-scroll to bottom
    setTimeout(() => {
      resBody.scrollTop = resBody.scrollHeight;
    }, 100);
  }

  function typewriterEffect(text, element) {
    let i = 0;
    const speed = 1; // milliseconds per tick (very fast)
    const chunk = Math.max(50, Math.ceil(text.length / 10)); // print big chunks
    element.innerHTML = ''; // Clear content first
    let isAborted = false; // Local flag to track if this specific typewriter was aborted
    
    const type = () => {
      if (printingAborted || isAborted) {
        isAborted = true;
        return;
      }
      
      if (i < text.length) {
        element.innerHTML = text.substring(0, i + chunk);
        i += chunk;
        setTimeout(type, speed);
        
        // Auto-scroll during typing
        const resBody = document.getElementById('main');
        if (resBody) {
          resBody.scrollTop = resBody.scrollHeight;
        }
      } else {
        // Typing completed - reset all states
        setIsPrinting(false);
        setIsLoading(false);
        setAbortController(null);
      }
    };
    
    // Store the abort function so we can call it externally if needed
    element._abortTypewriter = () => {
      isAborted = true;
    };
    
    type();
  }

  function addTimestamp(messageElement) {
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const timestamp = document.createElement('div');
    timestamp.className = 'message-timestamp';
    timestamp.textContent = time;
    messageElement.appendChild(timestamp);
  }

  function showLoadingMessage() {
    const chatBody = document.getElementById('main');
    if (!chatBody) return; // Safety check
    
    const loadingElement = document.createElement('div');
    loadingElement.className = 'bot-response loading-message';
    loadingElement.id = 'loading-message';
    loadingElement.innerHTML = `
      <div class="loading-dots">
        <span>Pithu is thinking</span>
        <div class="dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    `;
    chatBody.append(loadingElement);

    const spacer = document.createElement('div');
    spacer.style.height = '1em';
    spacer.id = 'loading-spacer';
    chatBody.append(spacer);

    // Auto-scroll to bottom
    setTimeout(() => {
      chatBody.scrollTop = chatBody.scrollHeight;
    }, 100);
  }

  function removeLoadingMessage() {
    const loadingMessage = document.getElementById('loading-message');
    const loadingSpacer = document.getElementById('loading-spacer');
    if (loadingMessage) {
      loadingMessage.remove();
    }
    if (loadingSpacer) {
      loadingSpacer.remove();
    }
  }

  function showRetryButton() {
    const chatBody = document.getElementById('main');
    if (!chatBody) return; // Safety check
    
    const retryContainer = document.createElement('div');
    retryContainer.className = 'retry-container';
    retryContainer.innerHTML = `
      <button class="retry-btn" onclick="retryLastMessage()">
        🔄 Try Again
      </button>
    `;
    chatBody.append(retryContainer);
    
    // Make retry function globally available
    window.retryLastMessage = () => {
      retryContainer.remove();
      generateAnswer();
    };
  }

  const calling = () => {
    if (isRateLimited) {
      alert("Please wait a moment due to rate limiting before trying again.");
      return;
    }
    
    if (question.trim()) { // Only proceed if there's a question
      sendMessage();
      generateAnswer();
      setQuestion(''); // Clear the input after sending
      // Reset input height back to original after sending
      const textarea = document.getElementById('chatInput');
      if (textarea) textarea.style.height = '48px';
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent newline
      calling();
    }
  };

  const handleInputChange = (e) => {
    setQuestion(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = '48px'; // Reset height
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 120; // Maximum height (about 3 lines)
    
    if (scrollHeight > 48) {
      textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    }
  };

  const startNewChat = () => {
    const chatBody = document.getElementById('main');
    if (!chatBody) return; // Safety check
    
    // Clear all messages except the start message
    chatBody.innerHTML = '<span class="start-message">Hello! How can I help you today?</span>';
    // Reset states
    setQuestion('');
    setAnswer('');
    setIsLoading(false);
    setIsPrinting(false);
    setPrintingAborted(false);
    // Cancel any ongoing request
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    // Reset input height back to original
    const textarea = document.getElementById('chatInput');
    if (textarea) textarea.style.height = '48px';
  };

  const stopLoading = () => {
    // Immediately set abort flags
    setPrintingAborted(true);
    setIsPrinting(false);
    setIsLoading(false);
    
    // Cancel any ongoing request
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    
    // Stop any active typewriter effects
    const chatBody = document.getElementById('main');
    if (!chatBody) return; // Safety check
    
    const responses = chatBody.querySelectorAll('.bot-response');
    responses.forEach(response => {
      if (response._abortTypewriter) {
        response._abortTypewriter();
      }
    });
    
    // Handle UI updates
    if (isPrinting) {
      // If we're printing the response, add stopped message to current response
      const lastResponse = responses[responses.length - 1];
      if (lastResponse && !lastResponse.classList.contains('loading-message')) {
        lastResponse.innerHTML += '<br><em style="color: #888; font-size: 12px;">[Response stopped by user]</em>';
      }
    } else {
      // If we're still loading, replace loading message with stopped message
      removeLoadingMessage();
      const stoppedElement = document.createElement('div');
      stoppedElement.className = 'bot-response';
      stoppedElement.textContent = "Request stopped by user.";
      addTimestamp(stoppedElement);
      chatBody.append(stoppedElement);

      const spacer = document.createElement('div');
      spacer.style.height = '1em';
      chatBody.append(spacer);
    }
    
    chatBody.scrollTop = chatBody.scrollHeight;
  };

  // Ensure chat scrolls to bottom on mount and when viewport changes (keyboard)
  useEffect(() => {
    const scrollToBottom = () => {
      const resBody = document.getElementById('main');
      if (resBody) resBody.scrollTop = resBody.scrollHeight;
    };
    scrollToBottom();

    const onResize = () => {
      // Delay to allow keyboard animation
      setTimeout(scrollToBottom, 150);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <>
      {/* Removed flag icon */}
      {/* <img id='flag' src="https://th.bing.com/th/id/R.2c0f2c2680c5440abab5e5e1bdbbfd28?rik=BZwWQO34B9FUEA&riu=http%3a%2f%2fwww.moud.in%2fmoudinternal%2fimages%2femblem.png&ehk=g7PpwwrbioveHPpP6%2bcJbBxZY40jhof%2bxM%2bqoqVD3Mg%3d&risl=&pid=ImgRaw&r=0" alt="" /> */}
      {/* <button className='chatbot-button' onClick={toggleChatbot}></button> */}
      <div className='chatbotBody open'>
        <div className='header'>
          <div className='header-content'>
            <div className='header-text'>
              <h2>Pithu</h2>
              <h5>Your Rucksack - <i>AI Companion</i></h5>
            </div>
            <button className='new-chat-btn' onClick={startNewChat} title="Start New Chat">
              🔄
            </button>
            <button className='new-chat-btn' onClick={toggleDarkMode} title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}>
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
        <div className='main' id="main">
          <span className='start-message'>Hello! How can I help you today?</span>
          <div id="responseText"></div>
        </div>

        <div className='chatbot-footer'>
          <textarea 
            value={question} 
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            rows="1" 
            id="chatInput" 
            placeholder="Ask me anything..."
            onFocus={() => {
              // Scroll input into view when keyboard opens
              setTimeout(() => {
                const el = document.getElementById('chatInput');
                el?.scrollIntoView({ behavior: 'smooth', block: 'end' });
              }, 150);
            }}
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
          {(isLoading || isPrinting) ? (
            <button className='btn stop-btn' onClick={stopLoading} title="Stop loading">
              ⏹️
            </button>
          ) : (
            <button className='btn' onClick={() => calling()}>Send</button>
          )}
        </div>
      </div>
    </>
  )
}

export default App
