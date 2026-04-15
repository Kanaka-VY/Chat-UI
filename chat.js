$(function () {
    const $messages = $("#messages");
    const $input = $("#messageInput");
    const $sendBtn = $("#sendBtn");
    const $typing = $("#typingIndicator");
    const $welcome = $("#welcomeScreen");
    const $menuToggle = $("#menuToggle");
    const $sidebar = $("#sidebar");
    const $overlay = $("#sidebarOverlay");
  
    const aiResponses = [
      "That sounds great! I can help you build that step by step.",
      "Try using a mobile-first layout with CSS grid and media queries.",
      "You can improve readability by adding spacing and a cleaner color contrast.",
      "Let's split this into smaller tasks so it's easier to implement.",
      "Good idea. Start with HTML structure, then style, then JavaScript behavior."
    ];

    const conversation = [];
    const chats = [];
    let activeChatIndex = 0;

    function normalize(text) {
      return String(text || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
    }

    function includesAny(haystack, needles) {
      return needles.some((n) => haystack.includes(n));
    }

    function buildThreadTitle(text) {
      const clean = String(text || "").replace(/\s+/g, " ").trim();
      if (!clean) return "New Conversation";
      const maxLen = 28;
      return clean.length > maxLen ? `${clean.slice(0, maxLen)}...` : clean;
    }

    function clearConversation() {
      conversation.length = 0;
    }

    function syncConversationFromActiveChat() {
      clearConversation();
      const activeChat = chats[activeChatIndex];
      if (!activeChat) return;
      activeChat.messages.forEach((message) => {
        conversation.push(message);
      });
    }

    function renderChatHistory() {
      const historyHtml = chats
        .map(
          (chat, index) =>
            `<div class="history-item ${index === activeChatIndex ? "active" : ""}" data-chat-index="${index}">${$("<div>")
              .text(chat.title)
              .html()}</div>`
        )
        .join("");
      $("#chatHistory").html(historyHtml);
    }

    function renderMessageBubble(message) {
      const isUser = message.sender === "user";
      const name = isUser ? "You" : "Assistant";
      const avatarClass = isUser ? "user-avatar" : "assistant-avatar";
      const bubbleClass = isUser ? "user-bubble" : "assistant-bubble";
      const rowClass = isUser ? "msg-row user" : "msg-row assistant";
      const avatarText = isUser ? "YU" : "AI";

      return `
        <article class="${rowClass}">
          ${isUser ? "" : `<div class="avatar ${avatarClass}">${avatarText}</div>`}
          <div class="bubble-wrap">
            <div class="message-meta">
              <span class="name">${name}</span>
              <span class="time">${getCurrentTime()}</span>
            </div>
            <div class="message-bubble ${bubbleClass}">${$("<div>").text(message.text).html()}</div>
          </div>
          ${isUser ? `<div class="avatar ${avatarClass}">${avatarText}</div>` : ""}
        </article>
      `;
    }

    function renderActiveChat() {
      $messages.empty();
      $typing.addClass("d-none");
      const activeChat = chats[activeChatIndex];
      if (!activeChat) return;

      if (!activeChat.messages.length) {
        $welcome.removeClass("d-none");
      } else {
        $welcome.addClass("d-none");
        const html = activeChat.messages.map(renderMessageBubble).join("");
        $messages.html(html);
      }

      syncConversationFromActiveChat();
      ensureScrollToLatest();
    }

    function setActiveChat(index) {
      if (!chats[index]) return;
      activeChatIndex = index;
      renderChatHistory();
      renderActiveChat();
    }

    function initChatsFromSidebar() {
      $("#chatHistory .history-item").each(function () {
        chats.push({
          title: $(this).text().trim() || "New Conversation",
          messages: [],
        });
      });
      if (!chats.length) {
        chats.push({ title: "Welcome Conversation", messages: [] });
      }
      setActiveChat(0);
    }

    function generateAiReply(userText) {
      const t = normalize(userText);
      if (!t) return aiResponses[0];

      // Small talk / control
      if (includesAny(t, ["hi", "hello", "hey", "good morning", "good evening"])) {
        return "Hi! Tell me what you’re working on (UI, CSS, JavaScript, or a project idea) and I’ll help you next.";
      }
      if (includesAny(t, ["thank", "thanks", "thx"])) {
        return "You’re welcome. Want me to give a quick example or help you apply it to your current UI?";
      }
      if (includesAny(t, ["bye", "goodbye", "see you"])) {
        return "See you! If you come back, paste your HTML/CSS/JS and tell me what you want to change.";
      }

      // Suggestion-card related intents
      if (includesAny(t, ["pricing section", "pricing table", "pricing page"])) {
        return [
          "Sure — for a responsive pricing section, use a 3-card grid that collapses to 1 column on mobile.",
          "Do you want 3 tiers (Basic/Pro/Team) or 4 tiers? I can draft the HTML + CSS structure.",
        ].join(" ");
      }

      if (includesAny(t, ["interview", "javascript interview", "js interview", "frontend interview"])) {
        return [
          "Here are 5 JavaScript interview questions:",
          "1) Explain `let` vs `const` vs `var`.",
          "2) What is a closure? Give a use-case.",
          "3) Explain event loop (microtasks vs macrotasks).",
          "4) What is `this` and how does it change with arrow functions?",
          "5) How does prototypal inheritance work?",
          "Want beginner, intermediate, or advanced level?",
        ].join("\n");
      }

      if (includesAny(t, ["bio", "portfolio bio", "professional bio", "about me"])) {
        return "Share your role (student/dev), 2-3 skills, and 1 project, and I’ll write a clean 2–3 line portfolio bio.";
      }

      if (includesAny(t, ["debug", "alignment", "center", "not centered", "flex", "grid"])) {
        return "If it’s a CSS alignment issue, tell me: the parent’s `display` (block/flex/grid), the child size, and what you expect. If you paste the CSS snippet, I’ll point out the exact fix.";
      }

      // Generic web dev intents
      if (includesAny(t, ["css", "responsive", "media query", "bootstrap"])) {
        return "For responsive UI: start mobile-first, use a simple grid, then add breakpoints (e.g. 576/768/992px). What section are you styling?";
      }
      if (includesAny(t, ["javascript", "js", "jquery", "function", "bug", "error"])) {
        return "Paste the JS snippet and the exact behavior you expect vs what happens. If there’s an error message, include it too.";
      }
      if (includesAny(t, ["html", "semantic", "accessibility", "aria"])) {
        return "Nice — using semantic tags and accessible labels helps a lot. What component are you building (form, navbar, cards, chat)?";
      }

      // Fallback: vary slightly but stay relevant.
      const lastUserMsg = conversation.slice().reverse().find((m) => m.sender === "user")?.text;
      if (lastUserMsg && normalize(lastUserMsg) === t) {
        return "I saw that — can you add one detail (goal, constraint, or screenshot description) so I can give a precise answer?";
      }

      return aiResponses[Math.floor(Math.random() * aiResponses.length)];
    }
  
    function getCurrentTime() {
      return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  
    function scrollToBottom(preferredTarget) {
      const chatMain = document.getElementById("chatMain");
      if (!chatMain) return;

      const scrollNow = () => {
        // Prefer explicit target (newly added message), then typing row, then latest message.
        const lastMsg = $messages.children().last()[0];
        const typingRow = document.querySelector("#typingIndicator .msg-row");
        const target = preferredTarget || ((typingRow && !$typing.hasClass("d-none")) ? typingRow : lastMsg);

        if (target && typeof target.scrollIntoView === "function") {
          target.scrollIntoView({ block: "end", behavior: "smooth" });
        } else {
          chatMain.scrollTop = chatMain.scrollHeight;
        }
      };

      // Do it now, then again after the DOM paints (more reliable)
      scrollNow();
      requestAnimationFrame(scrollNow);
      setTimeout(scrollNow, 0);
    }

    function ensureScrollToLatest(preferredTarget) {
      // Re-try a few times for late layout changes (fonts/animation/typing toggle)
      scrollToBottom(preferredTarget);
      [50, 120, 250].forEach((delay) => {
        setTimeout(() => scrollToBottom(preferredTarget), delay);
      });
    }

    function initAutoScrollObserver() {
      const messagesNode = $messages.get(0);
      const typingNode = $typing.get(0);
      if (!messagesNode || !typingNode || typeof MutationObserver !== "function") return;

      const observer = new MutationObserver(() => {
        ensureScrollToLatest();
      });

      observer.observe(messagesNode, { childList: true, subtree: true });
      observer.observe(typingNode, { attributes: true, childList: true, subtree: true });
    }
  
    function addMessage(text, sender, chatIndex = activeChatIndex) {
      const targetChat = chats[chatIndex];
      if (!targetChat) return;

      const message = { sender, text, time: Date.now() };
      targetChat.messages.push(message);

      if (sender === "user" && targetChat.messages.length === 1) {
        targetChat.title = buildThreadTitle(text);
        renderChatHistory();
      }

      if (chatIndex === activeChatIndex) {
        conversation.push(message);
        const messageHtml = renderMessageBubble(message);
        $messages.append(messageHtml);
        $welcome.addClass("d-none");
        const addedMessage = $messages.children().last()[0];
        ensureScrollToLatest(addedMessage);
      }
    }
  
    function autoResizeTextarea() {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 180) + "px";
    }
  
    function updateSendButton() {
      $sendBtn.prop("disabled", !$input.val().trim());
    }
  
    function hideWelcomeOnce() {
      if (!$welcome.hasClass("d-none")) {
        $welcome.addClass("d-none");
      }
    }
  
    function mockAiReply(userText, chatIndex) {
      $typing.removeClass("d-none");
      ensureScrollToLatest();
  
      const delay = Math.floor(Math.random() * 1000) + 1000; // 1-2 sec
      setTimeout(() => {
        if (chatIndex === activeChatIndex) {
          $typing.addClass("d-none");
        }
        const reply = generateAiReply(userText);
        addMessage(reply, "assistant", chatIndex);
        ensureScrollToLatest();
      }, delay);
    }
  
    function sendMessage() {
      const text = $input.val().trim();
      if (!text) return;
  
      hideWelcomeOnce();
      const targetChatIndex = activeChatIndex;
      addMessage(text, "user", targetChatIndex);
  
      $input.val("").trigger("input");
      updateSendButton();
  
      mockAiReply(text, targetChatIndex);
    }
  
    // Events
    $sendBtn.on("click", sendMessage);
  
    $input.on("input", function () {
      autoResizeTextarea.call(this);
      updateSendButton();
    });
  
    $input.on("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  
    $(".suggestion-card").on("click", function () {
      const text = $(this).data("text");
      $input.val(text).trigger("input");
      updateSendButton();
      $input.focus();
    });
  
    $("#newChatBtn").on("click", function () {
      chats.unshift({ title: "New Conversation", messages: [] });
      setActiveChat(0);
      $input.val("").trigger("input");
      updateSendButton();
  
      if ($(window).width() < 992) {
        $sidebar.removeClass("show");
        $overlay.removeClass("show");
      }
    });
  
    $menuToggle.on("click", function () {
      $sidebar.toggleClass("show");
      $overlay.toggleClass("show");
    });
  
    $overlay.on("click", function () {
      $sidebar.removeClass("show");
      $overlay.removeClass("show");
    });

    $("#chatHistory").on("click", ".history-item", function () {
      const index = Number($(this).data("chat-index"));
      if (!Number.isNaN(index)) {
        setActiveChat(index);
      }

      if ($(window).width() < 992) {
        $sidebar.removeClass("show");
        $overlay.removeClass("show");
      }
    });
  
    // Initial state
    initChatsFromSidebar();
    updateSendButton();
    initAutoScrollObserver();
  });