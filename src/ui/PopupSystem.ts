export class PopupSystem {
    private container: HTMLElement;

    constructor(parent: HTMLElement) {
        this.container = document.createElement('div');
        this.container.className = 'popup-container';
        // Ensure container doesn't block interactions
        this.container.style.pointerEvents = 'none';
        this.container.style.position = 'absolute';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.overflow = 'hidden';
        parent.appendChild(this.container);
    }

    show(text: string, style: 'perfect' | 'stumble' | 'turbo'): void {
        const popup = document.createElement('div');
        popup.className = `popup popup-${style}`;
        popup.innerText = text;

        // Randomize position slightly
        const top = 30 + Math.random() * 20;
        const left = 30 + Math.random() * 40;
        
        popup.style.position = 'absolute';
        popup.style.top = `${top}%`;
        popup.style.left = `${left}%`;
        // CSS classes should handle animation
        
        this.container.appendChild(popup);

        setTimeout(() => {
            if (this.container.contains(popup)) {
                this.container.removeChild(popup);
            }
        }, 1000); // Remove after 1 second
    }
}
