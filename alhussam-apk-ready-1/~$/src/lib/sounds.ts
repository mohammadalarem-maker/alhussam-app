/**
 * Audio utility for ERP feedback sounds.
 */

// Enhanced "Beep" sound using Web Audio API for high quality feedback
export const playScannerBeep = () => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Use a combination of tones for a richer "POS" sound
        const playTone = (freq: number, start: number, duration: number, vol: number) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + start);
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime + start);
            gainNode.gain.linearRampToValueAtTime(vol, audioContext.currentTime + start + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + start + duration);

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.start(audioContext.currentTime + start);
            oscillator.stop(audioContext.currentTime + start + duration);
        };

        // Short dual-tone blip
        playTone(1200, 0, 0.1, 0.2);
        playTone(1800, 0.02, 0.08, 0.15);
    } catch (error) {
        console.warn('Audio feedback failed:', error);
    }
};
