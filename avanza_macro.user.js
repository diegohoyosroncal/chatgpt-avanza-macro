// ==UserScript==
// @name         ChatGPT Avanza Macro
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Adds a macro button to ChatGPT to quickly continue conversations.
// @author       Diego Hoyos Roncal
// @match        https://chat.openai.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Function to create and append the button
    function createMacroButton() {
        const buttonText = 'Avanza Macro'; // Button text
        const buttonId = 'avanza-macro-button'; // Unique ID for the button
        const buttonClasses = 'btn relative btn-neutral'; // Classes for styling

        // Check if the button already exists to prevent duplicates
        if (document.getElementById(buttonId)) {
            console.log('Avanza Macro button already exists.');
            return;
        }

        // Find the target container for appending the button
        // This selector might need adjustment if ChatGPT's UI changes
        const targetContainer = document.querySelector('.flex.flex-col.w-full.py-2.flex-grow.md\:py-3.md\:pl-4.relative.border.border-black\/10.bg-white.dark\:border-gray-900\/50.dark\:text-white.dark\:bg-gray-700.rounded-md.shadow-\[0_0_10px_rgba\(0\,0\,0\,0.10\)\]');

        if (!targetContainer) {
            console.error('Target container for Avanza Macro button not found.');
            return;
        }

        // Create the button element
        const macroButton = document.createElement('button');
        macroButton.id = buttonId;
        macroButton.className = buttonClasses;
        macroButton.innerHTML = `
            <div class="flex w-full items-center justify-center gap-2">
                <svg stroke="currentColor" fill="none" stroke-width="1.5" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 5v14M5 12h14"></path>
                </svg>
                ${buttonText}
            </div>
        `;

        // Add event listener for button click
        macroButton.addEventListener('click', () => {
            console.log('Avanza Macro button clicked!');
            simulateEnterPress();
        });

        // Append the button to the target container
        targetContainer.appendChild(macroButton);
        console.log('Avanza Macro button created and appended.');
    }

    // Function to simulate an Enter key press in the textarea
    function simulateEnterPress() {
        const textarea = document.querySelector('textarea.m-0.w-full.resize-none.border-0.bg-transparent.p-0.pr-7.focus\:ring-0.focus-visible\:ring-0.dark\:bg-transparent.pl-2.md\:pl-0');

        if (textarea) {
            console.log('Textarea found. Simulating Enter press.');

            // Create and dispatch a keyboard event for 'Enter'
            const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
            });
            textarea.dispatchEvent(enterEvent);

            // If the chat sends on enter, this might be enough.
            // If not, we might need to simulate a click on the send button.
            // Let's try to find and click the send button as a fallback or additional action.
            const sendButton = textarea.nextElementSibling; // Assuming send button is the next sibling

            if (sendButton && sendButton.tagName === 'BUTTON') {
                console.log('Send button found. Clicking it.');
                sendButton.click();
            } else {
                console.log('Send button not found or is not a button.');
                // More robust way to find send button
                const sendButtonBySelector = document.querySelector('button.absolute.p-1.rounded-md.text-gray-500.bottom-1\.5.right-1.md\:right-2.dark\:hover\:text-gray-400.dark\:hover\:bg-gray-900.dark\:disabled\:hover\:bg-transparent');
                if (sendButtonBySelector) {
                    console.log('Send button found via selector. Clicking it.');
                    sendButtonBySelector.click();
                } else {
                    console.error('Could not find send button using any method.');
                }
            }
        } else {
            console.error('ChatGPT textarea not found.');
        }
    }

    // Observe changes in the DOM to dynamically add the button
    // This is useful when navigating between chats or refreshing the page
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length || mutation.removedNodes.length) {
                // Check if the chat input area is visible/reloaded
                const targetContainer = document.querySelector('.flex.flex-col.w-full.py-2.flex-grow.md\:py-3.md\:pl-4.relative.border.border-black\/10.bg-white.dark\:border-gray-900\/50.dark\:text-white.dark\:bg-gray-700.rounded-md.shadow-\[0_0_10px_rgba\(0\,0\,0\,0.10\)\]');
                if (targetContainer && !document.getElementById('avanza-macro-button')) {
                    console.log('DOM changed and target container is present. Attempting to create button.');
                    createMacroButton();
                }
                // If the button exists but the target container is gone, it might mean navigating away
                if (!targetContainer && document.getElementById('avanza-macro-button')) {
                    console.log('Target container removed. Removing Avanza Macro button.');
                    document.getElementById('avanza-macro-button').remove();
                }
            }
        });
    });

    // Start observing the document body for changes
    observer.observe(document.body, { childList: true, subtree: true });

    // Initial call to create the button in case it's already loaded
    createMacroButton();

    // Re-check and create button if URL changes without full page reload
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            console.log('URL changed. Re-checking for button.');
            // Give a short delay for the new page elements to render
            setTimeout(() => {
                if (!document.getElementById('avanza-macro-button')) {
                    createMacroButton();
                }
            }, 500);
        }
    }).observe(document, { subtree: true, childList: true });

})();