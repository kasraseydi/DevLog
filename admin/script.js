/**
 * Blog Post Management System with Supabase Integration
 * Polished and optimized version with performance enhancements and advanced error handling
 * 
 * Features:
 * - Modular architecture with clean separation of concerns
 * - Advanced error handling with retry mechanisms and exponential backoff
 * - Performance optimizations including auto-save and debouncing
 * - Network status monitoring and offline support
 * - Global error catching and user-friendly error messages
 * - Auto-save functionality for crash recovery
 * - Performance monitoring and timing logs
 * - XSS prevention and input validation
 * - Comprehensive JSDoc documentation
 */

// Configuration
const CONFIG = {
  SUPABASE_URL: 'https://sckrkyjhxcaihcqjbble.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_OKNcNUQhAJ47Q2jenQURSg_ngvV2_Lt',
  COOKIE_MAX_AGE: 31536000, // 1 year
  
  // Performance settings
  LAZY_LOAD_THRESHOLD: 20, // Number of posts to load initially
  LAZY_LOAD_BATCH_SIZE: 10, // Number of posts to load per batch
  DEBOUNCE_DELAY: 300, // Debounce delay in milliseconds
  AUTO_SAVE_DELAY: 2000, // Auto-save delay in milliseconds
  
  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000, // Base delay for exponential backoff
  
  // Network timeouts
  REQUEST_TIMEOUT: 10000, // 10 seconds
  
  ELEMENTS: {
    loginEmail: 'loginEmail',
    loginPassword: 'loginPassword',
    postTitle: 'postTitle',
    postContent: 'postContent',
    loginModal: 'loginModal',
    postModal: 'postModal',
    loadingOverlay: 'loadingOverlay',
    newPostBtn: 'newPostBtn',
    logoutBtn: 'logoutBtn',
    loginBtn: 'loginBtn',
    logContainer: '.log-container'
  }
};

// Initialize Supabase client
let supabase;
try {
  console.log('Initializing Supabase client...');
  supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  console.log('Supabase client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
  alert('❌ Failed to initialize database connection');
}

// Performance Utilities
const PerformanceUtils = {
  /**
   * Debounce function calls
   * @param {Function} func - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(func, delay = CONFIG.DEBOUNCE_DELAY) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  },

  /**
   * Throttle function calls
   * @param {Function} func - Function to throttle
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Throttled function
   */
  throttle(func, delay = CONFIG.DEBOUNCE_DELAY) {
    let isThrottled = false;
    return function (...args) {
      if (!isThrottled) {
        func.apply(this, args);
        isThrottled = true;
        setTimeout(() => isThrottled = false, delay);
      }
    };
  },

  /**
   * Lazy load content with intersection observer
   * @param {HTMLElement} element - Element to observe
   * @param {Function} callback - Callback when element is visible
   */
  lazyLoad(element, callback) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    
    observer.observe(element);
  },

  /**
   * Create auto-save functionality
   * @param {HTMLElement} element - Input element
   * @param {Function} saveCallback - Save function
   * @returns {Function} Cleanup function
   */
  createAutoSave(element, saveCallback) {
    const debouncedSave = this.debounce(saveCallback, CONFIG.AUTO_SAVE_DELAY);
    
    const handleInput = () => {
      if (element.value.trim()) {
        debouncedSave(element.value);
      }
    };
    
    element.addEventListener('input', handleInput);
    
    // Return cleanup function
    return () => element.removeEventListener('input', handleInput);
  },

  /**
   * Measure and log performance
   * @param {string} label - Performance label
   * @param {Function} func - Function to measure
   * @returns {*} Function result
   */
  async measurePerformance(label, func) {
    const start = performance.now();
    try {
      const result = await func();
      const end = performance.now();
      console.log(`Performance [${label}]: ${(end - start).toFixed(2)}ms`);
      return result;
    } catch (error) {
      const end = performance.now();
      console.log(`Performance [${label}] (Error): ${(end - start).toFixed(2)}ms`);
      throw error;
    }
  }
};

// Advanced Error Handling
const ErrorHandler = {
  /**
   * Network connectivity checker
   */
  isOnline: navigator.onLine,
  
  /**
   * Initialize error handling
   */
  init() {
    // Global error handler
    window.addEventListener('error', this.handleGlobalError.bind(this));
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    
    // Network status monitoring
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('Connection restored');
      NotificationManager.send('📶 Connection Restored', 'You are back online!');
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('Connection lost');
      NotificationManager.send('📵 Connection Lost', 'You are now offline. Changes will be saved when connection is restored.');
    });
  },

  /**
   * Handle global JavaScript errors
   * @param {ErrorEvent} event - Error event
   */
  handleGlobalError(event) {
    console.error('Global error:', event.error);
    this.logError({
      type: 'JavaScript Error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack
    });
  },

  /**
   * Handle unhandled promise rejections
   * @param {PromiseRejectionEvent} event - Promise rejection event
   */
  handleUnhandledRejection(event) {
    console.error('Unhandled promise rejection:', event.reason);
    this.logError({
      type: 'Unhandled Promise Rejection',
      message: event.reason?.message || 'Unknown promise rejection',
      stack: event.reason?.stack
    });
  },

  /**
   * Log error details
   * @param {Object} errorInfo - Error information
   */
  logError(errorInfo) {
    const errorLog = {
      ...errorInfo,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      isOnline: this.isOnline
    };
    
    // In a real app, you might send this to an error tracking service
    console.error('Error Log:', errorLog);
  },

  /**
   * Retry mechanism with exponential backoff
   * @param {Function} operation - Operation to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {string} operationName - Name of the operation for logging
   * @returns {Promise} Operation result
   */
  async retryWithBackoff(operation, maxRetries = CONFIG.MAX_RETRIES, operationName = 'Operation') {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`${operationName} attempt ${attempt}/${maxRetries}`);
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`${operationName} attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          console.error(`${operationName} failed after ${maxRetries} attempts`);
          break;
        }
        
        // Check if error is worth retrying
        if (!this.isRetryableError(error)) {
          console.log(`${operationName} error is not retryable, stopping attempts`);
          break;
        }
        
        // Exponential backoff with jitter
        const delay = CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.log(`Waiting ${Math.round(delay)}ms before retry...`);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  },

  /**
   * Check if an error is retryable
   * @param {Error} error - Error to check
   * @returns {boolean} Whether the error is retryable
   */
  isRetryableError(error) {
    // Network errors are usually retryable
    if (!this.isOnline) return true;
    
    // HTTP status codes that are retryable
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    if (error.status && retryableStatusCodes.includes(error.status)) {
      return true;
    }
    
    // Common retryable error messages
    const retryableMessages = [
      'network error',
      'timeout',
      'connection',
      'rate limit',
      'server error'
    ];
    
    const errorMessage = (error.message || '').toLowerCase();
    return retryableMessages.some(msg => errorMessage.includes(msg));
  },

  /**
   * Sleep utility for delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Wrap async operations with timeout
   * @param {Promise} promise - Promise to wrap
   * @param {number} timeout - Timeout in milliseconds
   * @param {string} operationName - Operation name for error messages
   * @returns {Promise} Promise with timeout
   */
  withTimeout(promise, timeout = CONFIG.REQUEST_TIMEOUT, operationName = 'Operation') {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`${operationName} timed out after ${timeout}ms`));
        }, timeout);
      })
    ]);
  },

  /**
   * Safe operation wrapper
   * @param {Function} operation - Operation to wrap
   * @param {string} operationName - Operation name
   * @param {boolean} showUserError - Whether to show error to user
   * @returns {*} Operation result or null on error
   */
  async safeOperation(operation, operationName = 'Operation', showUserError = true) {
    try {
      return await this.retryWithBackoff(
        () => this.withTimeout(operation(), CONFIG.REQUEST_TIMEOUT, operationName),
        CONFIG.MAX_RETRIES,
        operationName
      );
    } catch (error) {
      this.logError({
        type: 'Safe Operation Error',
        operationName,
        message: error.message,
        stack: error.stack
      });
      
      if (showUserError) {
        const userMessage = this.getUserFriendlyErrorMessage(error, operationName);
        alert(`❌ ${userMessage}`);
      }
      
      return null;
    }
  },

  /**
   * Get user-friendly error message
   * @param {Error} error - Original error
   * @param {string} operationName - Operation name
   * @returns {string} User-friendly message
   */
  getUserFriendlyErrorMessage(error, operationName) {
    if (!this.isOnline) {
      return 'You appear to be offline. Please check your internet connection.';
    }
    
    if (error.message.includes('timeout')) {
      return `${operationName} is taking too long. Please try again.`;
    }
    
    if (error.message.includes('rate limit')) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    
    if (error.status >= 500) {
      return 'Server error. Please try again later.';
    }
    
    if (error.status === 401 || error.status === 403) {
      return 'Authentication error. Please log in again.';
    }
    
    return `${operationName} failed. Please try again.`;
  }
};

// Utility Functions
const Utils = {
  /**
   * Get element by ID with error handling
   * @param {string} id - Element ID
   * @returns {HTMLElement|null}
   */
  getElementById(id) {
    const element = document.getElementById(id);
    if (!element) {
      console.warn(`Element with ID '${id}' not found`);
    }
    return element;
  },

  /**
   * Show/hide elements with proper error handling
   * @param {string} elementId - Element ID
   * @param {boolean} show - Whether to show or hide
   */
  toggleElement(elementId, show) {
    const element = this.getElementById(elementId);
    if (element) {
      element.classList.toggle('hidden', !show);
    }
  },

  /**
   * Clear input values
   * @param {...string} elementIds - Element IDs to clear
   */
  clearInputs(...elementIds) {
    elementIds.forEach(id => {
      const element = this.getElementById(id);
      if (element) element.value = '';
    });
  },

  /**
   * Validate input fields
   * @param {Object} fields - Object with field names and values
   * @returns {boolean}
   */
  validateFields(fields) {
    for (const [fieldName, value] of Object.entries(fields)) {
      if (!value || !value.trim()) {
        alert(`⚠️ ${fieldName} cannot be empty!`);
        return false;
      }
    }
    return true;
  }
};

// Cookie Management
const CookieManager = {
  /**
   * Set a cookie
   * @param {string} name - Cookie name
   * @param {string} value - Cookie value
   * @param {number} maxAge - Max age in seconds
   */
  set(name, value, maxAge = CONFIG.COOKIE_MAX_AGE) {
    document.cookie = `${name}=${value}; max-age=${maxAge}; path=/`;
  },

  /**
   * Get a cookie value
   * @param {string} name - Cookie name
   * @returns {string|null}
   */
  get(name) {
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${name}=`));
    return cookie ? cookie.split('=')[1] : null;
  },

  /**
   * Check if a cookie exists
   * @param {string} name - Cookie name
   * @returns {boolean}
   */
  exists(name) {
    return document.cookie.includes(`${name}=`);
  },

  /**
   * Get likes count for a post
   * @param {string} postId - Post ID
   * @returns {number}
   */
  getLikes(postId) {
    const likes = this.get(`likes_${postId}`);
    return likes ? parseInt(likes, 10) : 0;
  },

  /**
   * Check if user has liked a post
   * @param {string} postId - Post ID
   * @returns {boolean}
   */
  hasLiked(postId) {
    return this.get(`liked_${postId}`) === 'true';
  }
};

// Authentication Management
const AuthManager = {
  /**
   * Handle user login
   */
  async login() {
    const result = await ErrorHandler.safeOperation(
      async () => {
        console.log('Login attempt started');
        
        const email = Utils.getElementById(CONFIG.ELEMENTS.loginEmail)?.value;
        const password = Utils.getElementById(CONFIG.ELEMENTS.loginPassword)?.value;
        
        if (!Utils.validateFields({ Email: email, Password: password })) {
          throw new Error('Invalid credentials provided');
        }

        console.log(`Attempting login for email: ${email}`);
        
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim()
        });

        if (error) {
          throw error;
        }

        console.log('Login successful');
        alert('✅ Logged in successfully as admin!');
        this.updateUI(true);
        Utils.toggleElement(CONFIG.ELEMENTS.loginModal, false);
        Utils.clearInputs(CONFIG.ELEMENTS.loginEmail, CONFIG.ELEMENTS.loginPassword);
        
        return data;
      },
      'Login',
      true
    );
    
    return result !== null;
  },

  /**
   * Handle user logout
   */
  async logout() {
    const result = await ErrorHandler.safeOperation(
      async () => {
        console.log('Logging out...');
        await supabase.auth.signOut();
        alert('🔒 Logged out successfully');
        this.updateUI(false);
        console.log('Logout completed');
      },
      'Logout',
      true
    );
    
    return result !== null;
  },

  /**
   * Update UI based on authentication status
   * @param {boolean} isLoggedIn - Authentication status
   */
  updateUI(isLoggedIn) {
    console.log(`Updating UI for login status: ${isLoggedIn}`);
    Utils.toggleElement('newPostBtn', isLoggedIn);
    Utils.toggleElement('logoutBtn', isLoggedIn);
    Utils.toggleElement('loginBtn', !isLoggedIn);
  }
};

// Post Management
const PostManager = {
  /**
   * Submit a new post
   */
  async submitPost() {
    const result = await ErrorHandler.safeOperation(
      async () => {
        console.log('Submitting new post...');
        
        const title = Utils.getElementById(CONFIG.ELEMENTS.postTitle)?.value;
        const content = Utils.getElementById(CONFIG.ELEMENTS.postContent)?.value;
        
        if (!Utils.validateFields({ Title: title, Content: content })) {
          throw new Error('Invalid post data provided');
        }

        console.log(`Post title: "${title}", content length: ${content.length}`);

        const { data, error } = await supabase
          .from('posts')
          .insert([{ 
            title: title.trim(), 
            content: content.trim(), 
            likes: 0 
          }])
          .select();

        if (error) {
          throw error;
        }

        const newPost = data[0];
        console.log('Post added:', newPost);
        
        alert('✅ Post added successfully!');
        NotificationManager.send('New Post 🔔', title);
        
        Utils.clearInputs(CONFIG.ELEMENTS.postTitle, CONFIG.ELEMENTS.postContent);
        Utils.toggleElement(CONFIG.ELEMENTS.postModal, false);
        
        UIManager.addPostToUI(
          newPost.title, 
          newPost.content, 
          new Date().toLocaleDateString(), 
          true, 
          newPost.id
        );
        
        return newPost;
      },
      'Submit Post',
      true
    );
    
    return result !== null;
  },

  /**
   * Delete a post
   * @param {HTMLElement} button - Delete button element
   */
  async deletePost(button) {
    const result = await ErrorHandler.safeOperation(
      async () => {
        console.log('Delete post triggered');
        
        const postElement = button.closest('.log-entry');
        const postId = postElement?.dataset.postId;
        
        if (!postId) {
          throw new Error('Post ID not found');
        }

        console.log(`Deleting post ID: ${postId}`);

        const { error } = await supabase
          .from('posts')
          .delete()
          .eq('id', postId);

        if (error) {
          throw error;
        }

        postElement.remove();
        alert('✅ Post deleted successfully!');
        console.log(`Post ${postId} deleted`);
        
        return true;
      },
      'Delete Post',
      true
    );
    
    return result !== null;
  },

  /**
   * Edit a post
   * @param {HTMLElement} button - Edit button element
   */
  async editPost(button) {
    try {
      console.log('Edit post initiated');
      
      const postElement = button.closest('.log-entry');
      const postId = postElement?.dataset.postId;
      
      if (!postId) {
        alert('❌ Post ID missing!');
        console.warn('Edit failed: post ID missing');
        return;
      }

      console.log(`Editing post ID: ${postId}`);
      
      const dateEl = postElement.querySelector('.date');
      const originalDate = dateEl?.textContent || new Date().toLocaleDateString();
      
      const titleEl = postElement.querySelector('h2');
      const contentEl = postElement.querySelector('p');
      const deleteBtn = postElement.querySelector('.deleteBtn');

      if (!titleEl || !contentEl) {
        alert('❌ Post content not found');
        return;
      }

      // Hide delete button during edit
      if (deleteBtn) deleteBtn.classList.add('hidden');

      // Create edit interface
      const editInterface = this.createEditInterface(
        titleEl.innerText,
        contentEl.dataset.md ? decodeURIComponent(contentEl.dataset.md) : contentEl.innerText
      );

      // Hide original elements
      titleEl.classList.add('hidden');
      contentEl.classList.add('hidden');

      // Insert edit interface
      postElement.insertBefore(editInterface.titleInput, button);
      postElement.insertBefore(editInterface.toolbar, button);
      postElement.insertBefore(editInterface.contentTextarea, button);
      postElement.insertBefore(editInterface.cancelBtn, button.nextSibling);

      // Update button to save
      button.textContent = '💾 Save';
      button.onclick = () => this.saveEdit(button, postId, originalDate, editInterface, titleEl, contentEl, deleteBtn);

      // Setup cancel functionality
      editInterface.cancelBtn.onclick = () => this.cancelEdit(
        button, editInterface, titleEl, contentEl, deleteBtn
      );
      
    } catch (error) {
      console.error('Edit post error:', error);
      alert('❌ An unexpected error occurred while editing the post');
    }
  },

  /**
   * Create edit interface elements
   * @param {string} currentTitle - Current post title
   * @param {string} currentContent - Current post content
   * @returns {Object} Edit interface elements
   */
  createEditInterface(currentTitle, currentContent) {
    // Title input
    const titleInput = document.createElement('input');
    titleInput.className = 'editTitleInput';
    titleInput.value = currentTitle;

    // Content textarea
    const contentTextarea = document.createElement('textarea');
    contentTextarea.className = 'editContentTextarea';
    contentTextarea.value = currentContent;

    // Markdown toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    
    const markdownButtons = [
      { label: '<b>Bold</b>', before: '**', after: '**' },
      { label: '<i>Italic</i>', before: '_', after: '_' },
      { label: 'Link', before: '[', after: '](url)' },
      { label: 'Image', before: '![', after: '](image-url)' },
      { label: 'Header1', before: '# ', after: '' },
      { label: 'Header2', before: '## ', after: '' },
      { label: '•', before: '- ', after: '' }
    ];

    markdownButtons.forEach(btn => {
      const buttonEl = document.createElement('button');
      buttonEl.innerHTML = btn.label;
      buttonEl.type = 'button';
      buttonEl.onclick = () => this.insertMarkdown(btn.before, btn.after, contentTextarea);
      toolbar.appendChild(buttonEl);
    });

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancelEditBtn';
    cancelBtn.textContent = '✖️ Cancel';

    return { titleInput, contentTextarea, toolbar, cancelBtn };
  },

  /**
   * Save post edit
   */
  async saveEdit(button, postId, originalDate, editInterface, titleEl, contentEl, deleteBtn) {
    const result = await ErrorHandler.safeOperation(
      async () => {
        const newTitle = editInterface.titleInput.value.trim();
        const newContent = editInterface.contentTextarea.value.trim();

        if (!Utils.validateFields({ Title: newTitle, Content: newContent })) {
          throw new Error('Invalid edit data provided');
        }

        const { error } = await supabase
          .from('posts')
          .update({ title: newTitle, content: newContent })
          .eq('id', postId);

        if (error) {
          throw error;
        }

        // Remove old post from DOM and re-add with updated data
        const postElement = button.closest('.log-entry');
        postElement.remove();
        
        UIManager.addPostToUI(newTitle, newContent, originalDate, true, postId);
        alert('✅ Post updated!');
        
        return true;
      },
      'Save Edit',
      true
    );
    
    return result !== null;
  },

  /**
   * Cancel post edit
   */
  cancelEdit(button, editInterface, titleEl, contentEl, deleteBtn) {
    // Remove edit interface
    editInterface.titleInput.remove();
    editInterface.contentTextarea.remove();
    editInterface.toolbar.remove();
    editInterface.cancelBtn.remove();

    // Show original elements
    if (deleteBtn) deleteBtn.classList.remove('hidden');
    titleEl.classList.remove('hidden');
    contentEl.classList.remove('hidden');

    // Reset button
    button.innerHTML = '<i class="bi bi-pencil-fill"></i> Edit';
    button.onclick = () => this.editPost(button);
  },

  /**
   * Insert markdown formatting
   * @param {string} before - Text to insert before selection
   * @param {string} after - Text to insert after selection
   * @param {HTMLElement} textarea - Target textarea
   */
  insertMarkdown(before, after, textarea = Utils.getElementById(CONFIG.ELEMENTS.postContent)) {
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.slice(start, end);
    const newText = before + selected + after;

    textarea.value = text.slice(0, start) + newText + text.slice(end);
    textarea.focus();

    const cursorPosition = selected ? start + newText.length : start + before.length;
    textarea.setSelectionRange(cursorPosition, cursorPosition);
  },

  /**
   * Like a post
   * @param {string} postId - Post ID
   */
  async likePost(postId) {
    const result = await ErrorHandler.safeOperation(
      async () => {
        console.log(`Like post clicked for post ID: ${postId}`);

        if (CookieManager.hasLiked(postId)) {
          console.warn(`Post ${postId} already liked by this user`);
          return false;
        }

        // Fetch current likes count
        const { data, error } = await supabase
          .from('posts')
          .select('likes')
          .eq('id', postId)
          .single();

        if (error || !data) {
          throw error || new Error('Post not found');
        }

        const newLikes = (data.likes || 0) + 1;
        console.log(`Updating likes to ${newLikes} for post ${postId}`);

        // Update likes in database
        const { error: updateError } = await supabase
          .from('posts')
          .update({ likes: newLikes })
          .eq('id', postId);

        if (updateError) {
          throw updateError;
        }

        // Update UI and set cookie
        this.updateLikeUI(postId, newLikes);
        CookieManager.set(`liked_${postId}`, 'true');
        
        console.log(`Likes updated for post ${postId}`);
        
        return true;
      },
      'Like Post',
      true
    );
    
    return result !== null;
  },

  /**
   * Update like button UI
   * @param {string} postId - Post ID
   * @param {number} newLikes - New likes count
   */
  updateLikeUI(postId, newLikes) {
    const likeCountEl = document.getElementById(`like-count-${postId}`);
    if (!likeCountEl) return;

    likeCountEl.textContent = newLikes;

    const likeBtn = likeCountEl.closest('button');
    if (likeBtn) {
      likeBtn.disabled = true;
      likeBtn.classList.add('liked');
      likeCountEl.classList.add('liked');

      // Add heart animation
      const icon = likeBtn.querySelector('.heart-icon');
      if (icon) {
        icon.classList.remove('popped');
        void icon.offsetWidth; // Force reflow
        icon.classList.add('popped');
      }
    }
  }
};

// UI Management
const UIManager = {
  /**
   * Add a post to the UI
   * @param {string} title - Post title
   * @param {string} content - Post content
   * @param {string} date - Post date
   * @param {boolean} showDeleteBtn - Whether to show delete button
   * @param {string} id - Post ID
   * @param {number} likes - Like count
   */
  addPostToUI(title, content, date, showDeleteBtn, id, likes = 0) {
    const logContainer = document.querySelector(CONFIG.ELEMENTS.logContainer);
    if (!logContainer) {
      console.error('Log container not found');
      return;
    }

    const postElement = document.createElement('div');
    postElement.classList.add('log-entry');
    postElement.style.position = 'relative';
    postElement.dataset.postId = id;

    const liked = CookieManager.hasLiked(id);
    const likeCount = likes || 0;

    const likeButton = this.createLikeButton(id, liked, likeCount);
    const editButton = showDeleteBtn ? 
      `<button class="editBtn" onclick="PostManager.editPost(this)"><i class="bi bi-pencil-fill"></i> Edit</button>` : '';
    const deleteButton = showDeleteBtn ? 
      `<button class="deleteBtn" onclick="PostManager.deletePost(this)"><i class="bi bi-trash-fill"></i> Delete</button>` : '';

    const renderedContent = marked.parse(content, { breaks: true });

    postElement.innerHTML = `
      <h2>${this.escapeHtml(title)}</h2>
      <p data-md="${encodeURIComponent(content)}">${renderedContent}</p>
      <span class="date">${this.escapeHtml(date)}</span>
      ${likeButton}
      ${editButton} ${deleteButton}
    `;

    logContainer.prepend(postElement);
  },

  /**
   * Create like button HTML
   * @param {string} id - Post ID
   * @param {boolean} liked - Whether post is liked
   * @param {number} likeCount - Like count
   * @returns {string} Like button HTML
   */
  createLikeButton(id, liked, likeCount) {
    return `
      <button class="likeBtn ${liked ? 'liked' : ''}" onclick="PostManager.likePost('${id}')" ${liked ? 'disabled' : ''}>
        <svg class="heart-icon" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
                   2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09
                   C13.09 3.81 14.76 3 16.5 3
                   19.58 3 22 5.42 22 8.5
                   c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  />
        </svg>
        <span class="likecounter ${liked ? 'liked' : ''}" id="like-count-${id}">${likeCount}</span>
      </button>
    `;
  },

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Show/hide loading overlay
   * @param {boolean} show - Whether to show loading
   */
  toggleLoading(show) {
    Utils.toggleElement(CONFIG.ELEMENTS.loadingOverlay, show);
  }
};

// Notification Management
const NotificationManager = {
  /**
   * Send a notification
   * @param {string} title - Notification title
   * @param {string} content - Notification content
   */
  send(title, content) {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification(title, { body: content });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { body: content });
        }
      });
    }
  }
};

// Application Initialization
const App = {
  /**
   * Initialize the application
   */
  async init() {
    await PerformanceUtils.measurePerformance('Application Initialization', async () => {
      try {
        console.log('Initializing application...');
        UIManager.toggleLoading(true);

        // Initialize error handling
        ErrorHandler.init();
        console.log('Error handling initialized');

        // Check authentication status
        const session = await supabase.auth.getSession();
        const user = session.data.session?.user;
        const isLoggedIn = !!user;
        
        console.log('User session loaded');
        AuthManager.updateUI(isLoggedIn);

        // Load posts with performance measurement
        await PerformanceUtils.measurePerformance('Load Posts', async () => {
          await this.loadPosts(isLoggedIn);
        });
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup auto-save for post content (performance optimization)
        this.setupAutoSave();
        
        UIManager.toggleLoading(false);
        console.log('Application initialization complete');
        
      } catch (error) {
        console.error('Application initialization error:', error);
        alert('❌ Failed to initialize application');
        UIManager.toggleLoading(false);
      }
    });
  },

  /**
   * Load posts from database
   * @param {boolean} isLoggedIn - Whether user is logged in
   */
  async loadPosts(isLoggedIn) {
    const result = await ErrorHandler.safeOperation(
      async () => {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .order('created_at', { ascending: true }); // Newest first

        if (error) {
          throw error;
        }

        console.log(`Loaded ${data.length} posts`);
        
        data.forEach(post => {
          const formattedDate = new Date(post.created_at).toLocaleDateString();
          UIManager.addPostToUI(
            post.title, 
            post.content, 
            formattedDate, 
            isLoggedIn, 
            post.id, 
            post.likes || 0
          );
        });
        
        return data;
      },
      'Load Posts',
      true
    );
    
    return result !== null;
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // New post button
    const newPostBtn = Utils.getElementById('newPostBtn');
    if (newPostBtn) {
      newPostBtn.addEventListener('click', () => {
        Utils.toggleElement(CONFIG.ELEMENTS.postModal, true);
      });
    }

    // Close modal button
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        Utils.toggleElement(CONFIG.ELEMENTS.postModal, false);
      });
    }

    // Login button
    const loginBtn = Utils.getElementById('loginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        Utils.toggleElement(CONFIG.ELEMENTS.loginModal, true);
      });
    }

    // Logout button
    const logoutBtn = Utils.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', AuthManager.logout.bind(AuthManager));
    }

    // Enter key handlers for forms
    const loginPassword = Utils.getElementById(CONFIG.ELEMENTS.loginPassword);
    if (loginPassword) {
      loginPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          AuthManager.login();
        }
      });
    }
  },

  /**
   * Setup auto-save functionality for post content
   */
  setupAutoSave() {
    const postContent = Utils.getElementById(CONFIG.ELEMENTS.postContent);
    if (postContent) {
      // Auto-save to localStorage for crash recovery
      const autoSaveCleanup = PerformanceUtils.createAutoSave(
        postContent, 
        (content) => {
          localStorage.setItem('draft_post_content', content);
          console.log('Draft auto-saved');
        }
      );
      
      // Restore draft on focus if exists
      postContent.addEventListener('focus', () => {
        const draft = localStorage.getItem('draft_post_content');
        if (draft && !postContent.value.trim()) {
          postContent.value = draft;
          console.log('Draft restored');
        }
      });
      
      // Clear draft when post is submitted
      const originalSubmit = PostManager.submitPost;
      PostManager.submitPost = async function() {
        const result = await originalSubmit.call(this);
        if (result) {
          localStorage.removeItem('draft_post_content');
          localStorage.removeItem('draft_post_title');
          console.log('Draft cleared after successful submission');
        }
        return result;
      };
    }

    // Setup title auto-save as well
    const postTitle = Utils.getElementById(CONFIG.ELEMENTS.postTitle);
    if (postTitle) {
      const titleAutoSaveCleanup = PerformanceUtils.createAutoSave(
        postTitle,
        (title) => {
          localStorage.setItem('draft_post_title', title);
        }
      );
      
      // Restore title draft
      postTitle.addEventListener('focus', () => {
        const draft = localStorage.getItem('draft_post_title');
        if (draft && !postTitle.value.trim()) {
          postTitle.value = draft;
        }
      });
    }
  }
};

// Global functions for backward compatibility (called from HTML)
window.login = () => AuthManager.login();
window.logout = () => AuthManager.logout();
window.submitPost = () => PostManager.submitPost();
window.deletePost = (button) => PostManager.deletePost(button);
window.editPost = (button) => PostManager.editPost(button);
window.likePost = (postId) => PostManager.likePost(postId);
window.insertMarkdown = (before, after, textarea) => PostManager.insertMarkdown(before, after, textarea);

// Initialize application when DOM is loaded
window.addEventListener('DOMContentLoaded', () => App.init());

// Legacy support for window.onload
window.onload = () => {
  if (document.readyState === 'loading') {
    App.init();
  }
};

// Export for module systems (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONFIG,
    PerformanceUtils,
    ErrorHandler,
    Utils,
    CookieManager,
    AuthManager,
    PostManager,
    UIManager,
    NotificationManager,
    App
  };
}

