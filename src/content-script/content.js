chrome.runtime.sendMessage({
    type: "checkme",
    contentType: document.contentType
})

export {};