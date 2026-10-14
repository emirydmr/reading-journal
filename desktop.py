"""Small native macOS control window for the journal's local browser interface."""

from __future__ import annotations

import webbrowser


def run_window(url, stop, stopped):
    import objc
    from Cocoa import (
        NSApplication, NSApplicationActivationPolicyRegular, NSBackingStoreBuffered,
        NSButton, NSColor, NSFont, NSMakeRect, NSMenu, NSMenuItem, NSObject,
        NSTextField, NSTimer, NSTerminateNow, NSWindow,
        NSWindowStyleMaskTitled, NSWindowStyleMaskClosable, NSWindowStyleMaskMiniaturizable,
    )

    application = NSApplication.sharedApplication()
    application.setActivationPolicy_(NSApplicationActivationPolicyRegular)

    class JournalControlDelegate(NSObject):
        @objc.IBAction
        def openBrowser_(self, sender):
            webbrowser.open_new_tab(url)

        @objc.IBAction
        def quitJournal_(self, sender):
            stop()
            application.terminate_(None)

        def applicationShouldTerminate_(self, sender):
            stop()
            return NSTerminateNow

        def windowShouldClose_(self, sender):
            self.quitJournal_(sender)
            return False

        def checkServer_(self, timer):
            if stopped.is_set():
                timer.invalidate()
                application.terminate_(None)

    delegate = JournalControlDelegate.alloc().init()
    application.setDelegate_(delegate)
    menu = NSMenu.alloc().init()
    app_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_("Reading Journal", None, "")
    submenu = NSMenu.alloc().initWithTitle_("Reading Journal")
    quit_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_("Quit Reading Journal", "quitJournal:", "q")
    quit_item.setTarget_(delegate)
    submenu.addItem_(quit_item)
    app_item.setSubmenu_(submenu)
    menu.addItem_(app_item)
    application.setMainMenu_(menu)

    style = NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskMiniaturizable
    window = NSWindow.alloc().initWithContentRect_styleMask_backing_defer_(NSMakeRect(0, 0, 440, 235), style, NSBackingStoreBuffered, False)
    window.setTitle_("Reading Journal")
    window.setReleasedWhenClosed_(False)
    window.setDelegate_(delegate)
    window.setBackgroundColor_(NSColor.colorWithCalibratedRed_green_blue_alpha_(0.96, 0.97, 0.95, 1))
    view = window.contentView()

    def text(value, rect, size, bold=False):
        label = NSTextField.labelWithString_(value)
        label.setFrame_(NSMakeRect(*rect))
        label.setFont_(NSFont.boldSystemFontOfSize_(size) if bold else NSFont.systemFontOfSize_(size))
        label.setTextColor_(NSColor.colorWithCalibratedRed_green_blue_alpha_(0.09, 0.24, 0.22, 1))
        view.addSubview_(label)

    text("Reading Journal", (28, 164, 384, 34), 25, True)
    text("Your journal is running.", (28, 128, 384, 25), 15)
    text("Open the journal in your browser to view reports\nand change settings. Closing this window quits the app.", (28, 76, 384, 45), 12)
    for title, action, rect in [
        ("Open in Browser", "openBrowser:", (24, 24, 210, 36)),
        ("Quit", "quitJournal:", (285, 24, 130, 36)),
    ]:
        button = NSButton.alloc().initWithFrame_(NSMakeRect(*rect))
        button.setTitle_(title)
        button.setBezelStyle_(1)
        button.setTarget_(delegate)
        button.setAction_(action)
        view.addSubview_(button)
    timer = NSTimer.scheduledTimerWithTimeInterval_target_selector_userInfo_repeats_(0.25, delegate, "checkServer:", None, True)
    window.center()
    window.makeKeyAndOrderFront_(None)
    application.activateIgnoringOtherApps_(True)
    try:
        application.run()
    finally:
        timer.invalidate()
        stop()
