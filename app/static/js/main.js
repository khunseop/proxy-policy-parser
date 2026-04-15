import { bindEvents, loadHistory } from './modules/events.js';
import { initResizers } from './modules/ui.js';

window.onload = () => {
    // 1. Load data
    loadHistory();
    
    // 2. Initialize UI components
    initResizers();
    
    // 3. Bind all event listeners
    bindEvents();
};
