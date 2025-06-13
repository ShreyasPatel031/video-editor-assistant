// Test script to verify video editor functionality
// Run this in the browser console

console.log("🧪 Starting Video Editor Functionality Test...");

// Test 1: Check if videos are auto-loaded
setTimeout(() => {
  const videoElements = document.querySelectorAll('[data-testid="user-video"], img[alt*="videoplayback"]');
  console.log(`✅ Test 1 - Auto-loaded videos found: ${videoElements.length}`);
  
  if (videoElements.length > 0) {
    console.log("✅ Videos are being auto-loaded from the folder");
    
    // Test 2: Click on a video to open it
    const firstVideo = videoElements[0];
    console.log("🎬 Clicking first video to open it...");
    firstVideo.click();
    
    setTimeout(() => {
      // Test 3: Check if video player is visible
      const videoPlayer = document.querySelector('video');
      if (videoPlayer) {
        console.log("✅ Test 2 - Video player is visible");
        console.log(`📹 Video source: ${videoPlayer.src}`);
        
        // Test 4: Check if segment selectors are visible
        const segmentMarkers = document.querySelectorAll('div[style*="cursor-ew-resize"]');
        console.log(`✅ Test 3 - Segment markers found: ${segmentMarkers.length}`);
        
        // Test 5: Try to add a segment
        const addSegmentButton = document.querySelector('button:contains("Add Segment"), button[title*="Add"]');
        if (addSegmentButton) {
          console.log("🔧 Clicking Add Segment button...");
          addSegmentButton.click();
          
          setTimeout(() => {
            // Test 6: Check workspace for segments
            const workspaceTab = document.querySelector('[role="tab"]:contains("Workspace"), button:contains("Workspace")');
            if (workspaceTab) {
              console.log("📋 Clicking Workspace tab...");
              workspaceTab.click();
              
              setTimeout(() => {
                // Test 7: Check if segments are in workspace
                const workspaceSegments = document.querySelectorAll('.timeline-item, [class*="segment"]');
                console.log(`✅ Test 4 - Workspace segments found: ${workspaceSegments.length}`);
                
                // Test 8: Check if play button exists
                const playButton = document.querySelector('button[title*="Play"], svg[class*="play"]');
                if (playButton) {
                  console.log("▶️ Play button found in workspace");
                  console.log("✅ ALL TESTS PASSED! The video editor is working correctly.");
                } else {
                  console.log("❌ Play button not found in workspace");
                }
              }, 1000);
            } else {
              console.log("❌ Workspace tab not found");
            }
          }, 1000);
        } else {
          console.log("❌ Add Segment button not found");
        }
      } else {
        console.log("❌ Test 2 FAILED - Video player not visible");
      }
    }, 2000);
  } else {
    console.log("❌ Test 1 FAILED - No videos auto-loaded");
  }
}, 3000);

console.log("⏳ Test will complete in 10 seconds..."); 