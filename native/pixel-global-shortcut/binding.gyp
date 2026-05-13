{
  "targets": [
    {
      "target_name": "pixel_global_shortcut",
      "sources": ["src/pixel_global_shortcut.mm"],
      "conditions": [
        [
          "OS=='mac'",
          {
            "xcode_settings": {
              "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
              "CLANG_ENABLE_OBJC_ARC": "YES",
              "MACOSX_DEPLOYMENT_TARGET": "12.0",
              "OTHER_LDFLAGS": [
                "-framework",
                "AppKit",
                "-framework",
                "ApplicationServices"
              ]
            }
          }
        ]
      ]
    }
  ]
}
