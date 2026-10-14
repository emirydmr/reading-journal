"""Native macOS window for the reading journal."""

from __future__ import annotations

import webbrowser
import threading
import urllib.parse
import urllib.request
from pathlib import Path


def run_window(url, stop, stopped):
    import objc
    from Cocoa import (
        NSApplication, NSApplicationActivationPolicyRegular, NSBackingStoreBuffered,
        NSImage, NSMakeRect, NSMenu, NSMenuItem, NSObject, NSAppearance, NSAppearanceNameAqua,
        NSScrollElasticityNone,
        NSBundle,
        NSURL, NSURLRequest, NSSavePanel, NSModalResponseOK, NSAlert, NSWorkspace,
        NSTimer, NSTerminateNow, NSWindow,
        NSWindowStyleMaskTitled, NSWindowStyleMaskClosable, NSWindowStyleMaskMiniaturizable, NSWindowStyleMaskResizable,
    )
    from WebKit import WKWebView, WKWebViewConfiguration
    from PyObjCTools import AppHelper

    application = NSApplication.sharedApplication()
    application.setActivationPolicy_(NSApplicationActivationPolicyRegular)
    icon_path = NSBundle.mainBundle().pathForResource_ofType_("ReadingJournal", "icns")
    if icon_path:
        icon = NSImage.alloc().initWithContentsOfFile_(icon_path)
        if icon:
            application.setApplicationIconImage_(icon)
    journal_window = None
    journal_view = None
    local_origin = urllib.parse.urlsplit(url).netloc

    class JournalControlDelegate(NSObject):
        @objc.IBAction
        def openJournal_(self, sender):
            nonlocal journal_window, journal_view
            if journal_window is None:
                style = NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable
                journal_window = NSWindow.alloc().initWithContentRect_styleMask_backing_defer_(NSMakeRect(0, 0, 1180, 780), style, NSBackingStoreBuffered, False)
                journal_window.setTitle_("Journal — Reading Journal")
                journal_window.setReleasedWhenClosed_(False)
                journal_window.setDelegate_(self)
                journal_window.setMinSize_((700, 480))
                journal_window.setAppearance_(NSAppearance.appearanceNamed_(NSAppearanceNameAqua))
                journal_view = WKWebView.alloc().initWithFrame_configuration_(journal_window.contentView().bounds(), WKWebViewConfiguration.alloc().init())
                journal_view.setAutoresizingMask_(18)
                journal_view.scrollView().setVerticalScrollElasticity_(NSScrollElasticityNone)
                journal_view.scrollView().setHorizontalScrollElasticity_(NSScrollElasticityNone)
                journal_view.setNavigationDelegate_(self)
                journal_view.setUIDelegate_(self)
                journal_window.setContentView_(journal_view)
                journal_view.loadRequest_(NSURLRequest.requestWithURL_(NSURL.URLWithString_(url)))
                journal_window.center()
            journal_window.makeKeyAndOrderFront_(None)
            application.activateIgnoringOtherApps_(True)

        def webView_decidePolicyForNavigationAction_decisionHandler_(self, view, action, decide):
            destination = str(action.request().URL().absoluteString())
            parsed = urllib.parse.urlsplit(destination)
            if parsed.netloc == local_origin and parsed.path == "/export":
                decide(0)
                panel = NSSavePanel.savePanel()
                panel.setNameFieldStringValue_("Reading Journal.html")
                if panel.runModal() == NSModalResponseOK:
                    target = Path(str(panel.URL().path()))
                    def save_export():
                        try:
                            with urllib.request.urlopen(destination, timeout=30) as response:
                                target.write_bytes(response.read())
                        except Exception as exc:
                            message = str(exc)
                            def show_error():
                                alert = NSAlert.alloc().init()
                                alert.setMessageText_("Could not export the journal")
                                alert.setInformativeText_(message)
                                alert.runModal()
                            AppHelper.callAfter(show_error)
                    threading.Thread(target=save_export, daemon=True).start()
            elif parsed.netloc == local_origin or destination == "about:blank":
                decide(1)
            elif parsed.scheme == "zotero":
                decide(0)
                NSWorkspace.sharedWorkspace().openURL_(NSURL.URLWithString_(destination))
            else:
                decide(0)
                webbrowser.open_new_tab(destination)

        def webView_createWebViewWithConfiguration_forNavigationAction_windowFeatures_(self, view, configuration, action, features):
            webbrowser.open_new_tab(str(action.request().URL().absoluteString()))
            return None

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

    timer = NSTimer.scheduledTimerWithTimeInterval_target_selector_userInfo_repeats_(0.25, delegate, "checkServer:", None, True)
    delegate.openJournal_(None)
    try:
        application.run()
    finally:
        timer.invalidate()
        stop()
