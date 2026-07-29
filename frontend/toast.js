// toast.js
(function() {
    // Create toast container if it doesn't exist
    document.addEventListener("DOMContentLoaded", function() {
        let container = document.getElementById('custom-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'custom-toast-container';
            document.body.appendChild(container);
        }
    });

    // Override the native alert
    window.alert = function(message) {
        let container = document.getElementById('custom-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'custom-toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'custom-toast';
        toast.innerText = message;

        // Change border color for errors or suppress if success
        if (message.toLowerCase().includes('error') || message.toLowerCase().includes('fail')) {
            toast.style.borderLeftColor = '#e53e3e';
        } else if (message.toLowerCase().includes('success') || message.toLowerCase().includes('welcome') || message.toLowerCase().includes('saved')) {
            // Ignore success messages as requested by the user
            return;
        } else {
            toast.style.borderLeftColor = '#38a169'; // default for others
        }

        container.appendChild(toast);

        // Trigger animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300); // Wait for transition
        }, 3000);
    };
})();
