// Subscribes to the battery-change event. Returns the first event if one
// arrives quickly; otherwise returns the subscription id so support can be
// isolated without waiting for the battery level to change.
const event = require("@system.event")

return new Promise((resolve, reject) => {
  let id
  let finished = false

  const finish = (value) => {
    if (finished) return
    finished = true
    setTimeout(() => {
      if (id !== undefined) event.unsubscribe({id})
    }, 0)
    resolve(value)
  }

  id = event.subscribe({
    eventName: "usual.event.BATTERY_CHANGED",
    callback: (res) => finish({id, firstEvent: res})
  })

  if (id === undefined) {
    reject(new Error("event.subscribe returned undefined"))
    return
  }

  setTimeout(() => finish({id, firstEvent: null}), 1500)
})
