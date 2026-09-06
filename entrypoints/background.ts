export default defineBackground(() => {
  // Use the action event so Chrome grants activeTab before opening the panel.
  // Opening an already available side panel is not itself an activeTab grant.
  browser.action.onClicked.addListener((tab) => {
    if (tab.id == null) return;
    // Keep this call synchronous with the gesture (no await before open).
    void browser.sidePanel.open({ windowId: tab.windowId })
      .catch(error => console.error('Impossibile aprire il pannello', error));
  });
  // Also reset the previous automatic behavior when upgrading the extension.
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
    .catch(error => console.error('Impossibile configurare il pannello', error));
});
