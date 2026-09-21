// Subscribes to the compass and returns the first sample.
const sensor = require("@system.sensor")

return new Promise((resolve, reject) => {
  if ( typeof(sensor.subscribeCompass) !== "function" ) {
    reject("sensor lacks subscribeCompass in this device")
  }
  sensor.subscribeCompass({
    callback: (res) => {
      setTimeout(() => sensor.unsubscribeCompass(), 0)
      resolve(res)
    },
    fail: (data, code) =>
      reject(new Error(`sensor.subscribeCompass failed, code=${code}, data=${repr(data)}`))
  })
})
