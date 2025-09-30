import React, { useState, useEffect, useRef } from 'react';
import { Play, Code, Terminal, Save, FolderOpen, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';

const App = () => {
  const [html, setHtml] = useState('');
  const [css, setCss] = useState('');
  const [js, setJs] = useState('');
  const [activeTab, setActiveTab] = useState('html');
  const [consoleOutput, setConsoleOutput] = useState([]);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestionType, setSuggestionType] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [previewKey, setPreviewKey] = useState(0);
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState('Untitled');
  const [showProjectList, setShowProjectList] = useState(false);
  const [toast, setToast] = useState(null);
  
  const textareaRef = useRef(null);
  const iframeRef = useRef(null);

  // Toast notification
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // IndexedDB setup
  useEffect(() => {
    const initDB = async () => {
      const request = indexedDB.open('WebIDE', 1);
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
        }
      };
      
      request.onsuccess = () => {
        loadProjects();
      };
      
      request.onerror = () => {
        showToast('Failed to initialize database', 'error');
      };
    };
    
    initDB();
  }, []);

  const loadProjects = async () => {
    const request = indexedDB.open('WebIDE', 1);
    request.onsuccess = (e) => {
      const db = e.target.result;
      const transaction = db.transaction(['projects'], 'readonly');
      const store = transaction.objectStore('projects');
      const getAll = store.getAll();
      
      getAll.onsuccess = () => {
        setProjects(getAll.result);
      };
    };
  };

  const saveProject = async () => {
    try {
      const request = indexedDB.open('WebIDE', 1);
      request.onsuccess = (e) => {
        const db = e.target.result;
        const transaction = db.transaction(['projects'], 'readwrite');
        const store = transaction.objectStore('projects');
        
        const project = {
          name: currentProject,
          html,
          css,
          js,
          timestamp: new Date().toISOString()
        };
        
        const existingProject = projects.find(p => p.name === currentProject);
        if (existingProject) {
          project.id = existingProject.id;
        }
        
        const saveRequest = store.put(project);
        
        saveRequest.onsuccess = () => {
          loadProjects();
          showToast(`Project "${currentProject}" saved successfully!`, 'success');
        };
        
        saveRequest.onerror = () => {
          showToast('Failed to save project', 'error');
        };
      };
      
      request.onerror = () => {
        showToast('Database error', 'error');
      };
    } catch (error) {
      showToast('Error saving project', 'error');
    }
  };

  const loadProject = (project) => {
    setHtml(project.html);
    setCss(project.css);
    setJs(project.js);
    setCurrentProject(project.name);
    setShowProjectList(false);
    showToast(`Project "${project.name}" loaded!`, 'success');
  };

  // Handle key events
  const handleKeyDown = (e) => {
    const value = e.target.value;
    const pos = e.target.selectionStart;
    const selEnd = e.target.selectionEnd;
    
    // Tab for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const tab = '  ';
      const newValue = value.substring(0, pos) + tab + value.substring(selEnd);
      setCurrentCode(newValue);
      
      setTimeout(() => {
        textareaRef.current.selectionStart = pos + tab.length;
        textareaRef.current.selectionEnd = pos + tab.length;
      }, 0);
      return;
    }
    
    // Check for ! at the beginning or after newline for HTML boilerplate
    if (e.key === '!' && activeTab === 'html') {
      const beforeCursor = value.substring(0, pos);
      if (beforeCursor.trim() === '' || beforeCursor.endsWith('\n')) {
        setShowSuggestion(true);
        setSuggestionType('boilerplate');
        setCursorPosition(pos);
        return;
      }
    }
    
    // Confirm suggestion with Enter
    if (e.key === 'Enter' && showSuggestion) {
      e.preventDefault();
      applySuggestion();
      return;
    }
    
    // Auto-close brackets and quotes
    if (e.key === '{' || e.key === '(' || e.key === '[' || e.key === '"' || e.key === "'") {
      e.preventDefault();
      const closeChar = { '{': '}', '(': ')', '[': ']', '"': '"', "'": "'" }[e.key];
      const newValue = value.substring(0, pos) + e.key + closeChar + value.substring(selEnd);
      setCurrentCode(newValue);
      
      setTimeout(() => {
        textareaRef.current.selectionStart = pos + 1;
        textareaRef.current.selectionEnd = pos + 1;
      }, 0);
      return;
    }
    
    // Auto-indent on Enter
    if (e.key === 'Enter' && !showSuggestion) {
      e.preventDefault();
      const beforeCursor = value.substring(0, pos);
      const lines = beforeCursor.split('\n');
      const currentLine = lines[lines.length - 1];
      const indent = currentLine.match(/^\s*/)[0];
      
      const newValue = value.substring(0, pos) + '\n' + indent + value.substring(selEnd);
      setCurrentCode(newValue);
      
      setTimeout(() => {
        textareaRef.current.selectionStart = pos + indent.length + 1;
        textareaRef.current.selectionEnd = pos + indent.length + 1;
      }, 0);
    }
    
    // Close suggestion on Escape
    if (e.key === 'Escape') {
      setShowSuggestion(false);
    }
  };

  const applySuggestion = () => {
    const currentValue = activeTab === 'html' ? html : activeTab === 'css' ? css : js;
    let newValue = '';
    
    if (suggestionType === 'boilerplate') {
      const boilerplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  
</body>
</html>`;
      newValue = currentValue.substring(0, cursorPosition - 1) + boilerplate + currentValue.substring(cursorPosition);
      setHtml(newValue);
    }
    
    setShowSuggestion(false);
  };

  // Update preview and capture console only when user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setPreviewKey(prev => prev + 1);
    }, 800);
    
    return () => clearTimeout(timer);
  }, [html, css, js]);

  // Render preview when previewKey changes
  useEffect(() => {
    if (!iframeRef.current || previewKey === 0) return;
    
    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    
    const iframeContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>${css}</style>
        </head>
        <body>
          ${html}
          <script>
            (function() {
              const originalLog = console.log;
              const originalError = console.error;
              const originalWarn = console.warn;
              
              console.log = function(...args) {
                window.parent.postMessage({ 
                  type: 'console',
                  level: 'log', 
                  data: args.map(arg => {
                    if (typeof arg === 'object') {
                      try {
                        return JSON.stringify(arg, null, 2);
                      } catch(e) {
                        return String(arg);
                      }
                    }
                    return String(arg);
                  })
                }, '*');
                originalLog.apply(console, args);
              };
              
              console.error = function(...args) {
                window.parent.postMessage({ 
                  type: 'console',
                  level: 'error', 
                  data: args.map(arg => String(arg))
                }, '*');
                originalError.apply(console, args);
              };
              
              console.warn = function(...args) {
                window.parent.postMessage({ 
                  type: 'console',
                  level: 'warn', 
                  data: args.map(arg => String(arg))
                }, '*');
                originalWarn.apply(console, args);
              };
              
              window.onerror = function(msg, url, lineNo, columnNo, error) {
                window.parent.postMessage({ 
                  type: 'console',
                  level: 'error', 
                  data: ['Error: ' + msg + ' (Line ' + lineNo + ')'] 
                }, '*');
                return false;
              };
            })();
          </script>
          <script>
            try {
              ${js}
            } catch(error) {
              console.error('Script Error: ' + error.message);
            }
          </script>
        </body>
      </html>
    `;
    
    iframeDoc.open();
    iframeDoc.write(iframeContent);
    iframeDoc.close();
  }, [previewKey]);

  // Listen for console messages from iframe
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data.type === 'console') {
        const message = e.data.data.join(' ');
        const timestamp = new Date().toLocaleTimeString();
        
        setConsoleOutput(prev => [...prev, { 
          type: e.data.level, 
          message,
          timestamp
        }]);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const getCurrentCode = () => {
    return activeTab === 'html' ? html : activeTab === 'css' ? css : js;
  };

  const setCurrentCode = (value) => {
    if (activeTab === 'html') setHtml(value);
    else if (activeTab === 'css') setCss(value);
    else if (activeTab === 'js') setJs(value);
  };

  const clearConsole = () => {
    setConsoleOutput([]);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg animate-slide-in ${
          toast.type === 'success' ? 'bg-green-600' : 
          toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Code className="w-5 h-5 text-blue-400" />
          <span className="font-semibold">{currentProject}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowProjectList(!showProjectList)}
            className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition"
          >
            <FolderOpen className="w-4 h-4" />
            Projects
          </button>
          <button
            onClick={saveProject}
            className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded transition"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      {/* Project List Modal */}
      {showProjectList && (
        <div className="absolute top-12 right-4 bg-gray-800 border border-gray-700 rounded shadow-lg z-10 w-64 max-h-96 overflow-auto">
          <div className="p-3 border-b border-gray-700 flex justify-between items-center">
            <span className="font-semibold">Saved Projects</span>
            <button onClick={() => setShowProjectList(false)} className="text-gray-400 hover:text-white">×</button>
          </div>
          {projects.length === 0 ? (
            <div className="p-4 text-gray-400 text-sm">No saved projects</div>
          ) : (
            projects.map(project => (
              <button
                key={project.id}
                onClick={() => loadProject(project)}
                className="w-full p-3 text-left hover:bg-gray-700 border-b border-gray-700 transition"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <div>
                    <div className="font-medium">{project.name}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(project.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor Panel */}
        <div className="flex flex-col w-1/2 border-r border-gray-700">
          {/* Tabs */}
          <div className="flex bg-gray-800 border-b border-gray-700">
            {['html', 'css', 'js'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 border-r border-gray-700 transition ${
                  activeTab === tab 
                    ? 'bg-gray-900 text-blue-400' 
                    : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Code Editor */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={getCurrentCode()}
              onChange={(e) => setCurrentCode(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-full p-4 bg-gray-900 text-gray-100 font-mono text-sm resize-none focus:outline-none"
              placeholder={`Write your ${activeTab.toUpperCase()} code here...\n\nTips:\n- Type ! for HTML boilerplate\n- Press Tab for indentation\n- Auto-closing brackets enabled`}
              spellCheck="false"
            />
            
            {/* Suggestion Popup */}
            {showSuggestion && (
              <div className="absolute top-16 left-4 bg-gray-800 border border-blue-500 rounded shadow-lg px-3 py-2 text-sm">
                <div className="text-blue-400 font-medium">
                  HTML5 Boilerplate
                </div>
                <div className="text-gray-400 text-xs mt-1">Press Enter to apply</div>
              </div>
            )}
          </div>
        </div>

        {/* Preview & Console Panel */}
        <div className="flex flex-col w-1/2">
          {/* Preview */}
          <div className="flex-1 bg-white">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
              <span className="text-sm font-medium">Preview</span>
              <Play className="w-4 h-4 text-green-400" />
            </div>
            <iframe
              ref={iframeRef}
              className="w-full h-full border-0"
              title="preview"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>

          {/* Console */}
          <div className="h-48 bg-gray-900 border-t border-gray-700 flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                <span className="text-sm font-medium">Console</span>
              </div>
              <button
                onClick={clearConsole}
                className="text-xs text-gray-400 hover:text-white transition"
              >
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2 font-mono text-xs">
              {consoleOutput.length === 0 ? (
                <div className="text-gray-500 p-2">Console output will appear here...</div>
              ) : (
                consoleOutput.map((log, i) => (
                  <div
                    key={i}
                    className={`py-1 border-b border-gray-800 ${
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'warn' ? 'text-yellow-400' :
                      'text-gray-300'
                    }`}
                  >
                    <span className="text-gray-500 mr-2">[{log.timestamp}]</span>
                    <span className={`mr-2 font-semibold ${
                      log.type === 'error' ? 'text-red-500' :
                      log.type === 'warn' ? 'text-yellow-500' :
                      'text-blue-500'
                    }`}>
                      {log.type === 'error' ? '✕' : log.type === 'warn' ? '⚠' : '›'}
                    </span>
                    {log.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default App;