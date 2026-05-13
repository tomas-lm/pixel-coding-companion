#import <AppKit/AppKit.h>
#include <ApplicationServices/ApplicationServices.h>
#include <node_api.h>

#include <atomic>
#include <cstdint>
#include <deque>
#include <mutex>

namespace {

struct QueuedEvent {
  int type;
  uint16_t keyCode;
  bool alt;
  bool control;
  bool meta;
  bool shift;
};

std::atomic<bool> g_running(false);
std::deque<QueuedEvent> g_events;
std::mutex g_eventsMutex;
id g_eventMonitor = nil;

constexpr int kEventTypeKeyDown = 10;
constexpr int kEventTypeKeyUp = 11;
constexpr int kEventTypeFlagsChanged = 12;
constexpr CGKeyCode kKeyCodeV = 0x09;
constexpr size_t kMaxQueuedEvents = 512;

napi_value Boolean(napi_env env, bool value) {
  napi_value output;
  napi_get_boolean(env, value, &output);
  return output;
}

void Throw(napi_env env, const char *message) {
  napi_throw_error(env, nullptr, message);
}

void SetBoolean(napi_env env, napi_value object, const char *name, bool value) {
  napi_value property;
  napi_get_boolean(env, value, &property);
  napi_set_named_property(env, object, name, property);
}

void SetNumber(napi_env env, napi_value object, const char *name, int value) {
  napi_value property;
  napi_create_int32(env, value, &property);
  napi_set_named_property(env, object, name, property);
}

int EventTypeFor(NSEvent *event) {
  switch (event.type) {
    case NSEventTypeKeyDown:
      return kEventTypeKeyDown;
    case NSEventTypeKeyUp:
      return kEventTypeKeyUp;
    case NSEventTypeFlagsChanged:
      return kEventTypeFlagsChanged;
    default:
      return 0;
  }
}

QueuedEvent QueuedEventFor(NSEvent *event) {
  const NSEventModifierFlags flags =
      event.modifierFlags & NSEventModifierFlagDeviceIndependentFlagsMask;

  return QueuedEvent{
      EventTypeFor(event),
      event.keyCode,
      (flags & NSEventModifierFlagOption) != 0,
      (flags & NSEventModifierFlagControl) != 0,
      (flags & NSEventModifierFlagCommand) != 0,
      (flags & NSEventModifierFlagShift) != 0,
  };
}

void PushEvent(const QueuedEvent &event) {
  if (event.type == 0) return;

  std::lock_guard<std::mutex> lock(g_eventsMutex);
  if (g_events.size() >= kMaxQueuedEvents) {
    g_events.pop_front();
  }
  g_events.push_back(event);
}

void StopMonitoringInternal() {
  if (g_eventMonitor) {
    [NSEvent removeMonitor:g_eventMonitor];
    g_eventMonitor = nil;
  }

  g_running.store(false);
  std::lock_guard<std::mutex> lock(g_eventsMutex);
  g_events.clear();
}

napi_value IsMonitoring(napi_env env, napi_callback_info info) {
  (void)info;
  return Boolean(env, g_running.load());
}

napi_value StartMonitoring(napi_env env, napi_callback_info info) {
  (void)info;

  if (g_running.load()) {
    return Boolean(env, true);
  }

  StopMonitoringInternal();

  @autoreleasepool {
    g_eventMonitor = [NSEvent
        addGlobalMonitorForEventsMatchingMask:NSEventMaskFlagsChanged | NSEventMaskKeyDown |
                                                NSEventMaskKeyUp
                                      handler:^(NSEvent *event) {
                                        PushEvent(QueuedEventFor(event));
                                      }];
  }

  if (!g_eventMonitor) {
    StopMonitoringInternal();
    return Boolean(env, false);
  }

  g_running.store(true);
  return Boolean(env, true);
}

napi_value StopMonitoring(napi_env env, napi_callback_info info) {
  (void)info;
  StopMonitoringInternal();
  return Boolean(env, true);
}

napi_value PasteClipboard(napi_env env, napi_callback_info info) {
  (void)info;

  CGEventRef keyDown = CGEventCreateKeyboardEvent(nullptr, kKeyCodeV, true);
  CGEventRef keyUp = CGEventCreateKeyboardEvent(nullptr, kKeyCodeV, false);
  if (!keyDown || !keyUp) {
    if (keyDown) CFRelease(keyDown);
    if (keyUp) CFRelease(keyUp);
    return Boolean(env, false);
  }

  CGEventSetFlags(keyDown, kCGEventFlagMaskCommand);
  CGEventSetFlags(keyUp, kCGEventFlagMaskCommand);
  CGEventPost(kCGHIDEventTap, keyDown);
  CGEventPost(kCGHIDEventTap, keyUp);
  CFRelease(keyDown);
  CFRelease(keyUp);
  return Boolean(env, true);
}

napi_value GetNextEvent(napi_env env, napi_callback_info info) {
  (void)info;

  QueuedEvent event;
  {
    std::lock_guard<std::mutex> lock(g_eventsMutex);
    if (g_events.empty()) {
      napi_value nullValue;
      napi_get_null(env, &nullValue);
      return nullValue;
    }
    event = g_events.front();
    g_events.pop_front();
  }

  napi_value object;
  napi_create_object(env, &object);
  SetNumber(env, object, "type", event.type);
  SetNumber(env, object, "keyCode", event.keyCode);
  SetBoolean(env, object, "alt", event.alt);
  SetBoolean(env, object, "control", event.control);
  SetBoolean(env, object, "meta", event.meta);
  SetBoolean(env, object, "shift", event.shift);
  return object;
}

napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor descriptors[] = {
      {"isMonitoring", nullptr, IsMonitoring, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"startMonitoring", nullptr, StartMonitoring, nullptr, nullptr, nullptr, napi_default,
       nullptr},
      {"stopMonitoring", nullptr, StopMonitoring, nullptr, nullptr, nullptr, napi_default,
       nullptr},
      {"pasteClipboard", nullptr, PasteClipboard, nullptr, nullptr, nullptr, napi_default,
       nullptr},
      {"getNextEvent", nullptr, GetNextEvent, nullptr, nullptr, nullptr, napi_default, nullptr},
  };

  napi_status status = napi_define_properties(
      env,
      exports,
      sizeof(descriptors) / sizeof(descriptors[0]),
      descriptors);

  if (status != napi_ok) {
    Throw(env, "Could not initialize Pixel global shortcut native module.");
  }

  return exports;
}

}  // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
