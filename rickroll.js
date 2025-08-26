// Auto-play the video when page loads
document.addEventListener('DOMContentLoaded', function() {
    const video = document.querySelector('video');
    video.play().catch(function(error) {
        console.log("Video autoplay failed:", error);
    });
    
    // Handle close button click
    const closeBtn = document.getElementById('closeBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            window.close();
        });
    }
});
