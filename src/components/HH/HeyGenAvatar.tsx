import { useEffect, useRef } from "react";

interface HeyGenAvatarProps {
  isActive: boolean;
}

export function HeyGenAvatar({ isActive }: HeyGenAvatarProps) {
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    // Only load script once
    if (scriptLoadedRef.current) return;
    
    // HeyGen streaming embed script - EXACT implementation as provided by HeyGen
    const host = "https://labs.heygen.com";
    const shareUrl = "eyJxdWFsaXR5IjoiaGlnaCIsImF2YXRhck5hbWUiOiJlMWU4MjM0ZjEwOTI0NGNjODFjYjMyM2Rm%0D%0ANjczYTZlYyIsInByZXZpZXdJbWciOiJodHRwczovL2ZpbGVzMi5oZXlnZW4uYWkvYXZhdGFyL3Yz%0D%0AL2UxZTgyMzRmMTA5MjQ0Y2M4MWNiMzIzZGY2NzNhNmVjL2Z1bGwvMi4yL3ByZXZpZXdfdGFyZ2V0%0D%0ALndlYnAiLCJuZWVkUmVtb3ZlQmFja2dyb3VuZCI6ZmFsc2UsImtub3dsZWRnZUJhc2VJZCI6IjJl%0D%0AMmQ2MDA1OTBlMzQ4YWRiNGUwNTA1Mjc2MjhlNjkzIiwidXNlcm5hbWUiOiI3ZGEyNjY3YmQ0ODY0%0D%0AMTFmOWM4MzUwOWQyZDI0MjI0OSJ9";
    const url = `${host}/guest/streaming-embed?share=${shareUrl}&inIFrame=1`;
    const clientWidth = document.body.clientWidth;
    
    // Create wrapper div
    const wrapDiv = document.createElement("div");
    wrapDiv.id = "heygen-streaming-embed";
    
    // Create container
    const container = document.createElement("div");
    container.id = "heygen-streaming-container";
    
    // Use ORIGINAL HeyGen styling (floating bubble) - DO NOT MODIFY
    const stylesheet = document.createElement("style");
    stylesheet.innerHTML = `
      #heygen-streaming-embed {
        z-index: 9999;
        position: fixed;
        left: 40px;
        bottom: 40px;
        width: 200px;
        height: 200px;
        border-radius: 50%;
        border: 2px solid #fff;
        box-shadow: 0px 8px 24px 0px rgba(0, 0, 0, 0.12);
        transition: all linear 0.1s;
        overflow: hidden;
        opacity: 0;
        visibility: hidden;
      }
      #heygen-streaming-embed.show {
        opacity: 1;
        visibility: visible;
      }
      #heygen-streaming-embed.expand {
        ${clientWidth < 540 ? "height: 266px; width: 96%; left: 50%; transform: translateX(-50%);" : "height: 366px; width: calc(366px * 16 / 9);"}
        border: 0;
        border-radius: 8px;
      }
      #heygen-streaming-container {
        width: 100%;
        height: 100%;
      }
      #heygen-streaming-container iframe {
        width: 100%;
        height: 100%;
        border: 0;
      }
    `;
    
    // Create iframe
    const iframe = document.createElement("iframe");
    iframe.allowFullscreen = false;
    iframe.title = "Streaming Embed";
    iframe.role = "dialog";
    iframe.allow = "microphone";
    iframe.src = url;
    
    let visible = false;
    let initial = false;
    
    // Message listener for HeyGen events
    window.addEventListener("message", (e) => {
      if (e.origin === host && e.data && e.data.type && e.data.type === "streaming-embed") {
        if (e.data.action === "init") {
          initial = true;
          wrapDiv.classList.toggle("show", initial);
        } else if (e.data.action === "show") {
          visible = true;
          wrapDiv.classList.toggle("expand", visible);
        } else if (e.data.action === "hide") {
          visible = false;
          wrapDiv.classList.toggle("expand", visible);
        }
      }
    });
    
    // Assemble and inject
    container.appendChild(iframe);
    wrapDiv.appendChild(stylesheet);
    wrapDiv.appendChild(container);
    document.body.appendChild(wrapDiv);
    
    scriptLoadedRef.current = true;
    
    // Cleanup on unmount
    return () => {
      const existingEmbed = document.getElementById("heygen-streaming-embed");
      if (existingEmbed) {
        existingEmbed.remove();
      }
    };
  }, []);
  
  // Show/hide based on isActive prop
  useEffect(() => {
    const wrapDiv = document.getElementById("heygen-streaming-embed");
    if (wrapDiv) {
      if (isActive) {
        wrapDiv.classList.add("show");
        // Trigger click/interaction to potentially auto-start
        setTimeout(() => {
          const iframe = wrapDiv.querySelector("iframe");
          if (iframe) {
            iframe.focus();
          }
        }, 500);
      } else {
        wrapDiv.classList.remove("show", "expand");
      }
    }
  }, [isActive]);
  
  // This component doesn't render anything visible - it manages the HeyGen widget
  return null;
}
