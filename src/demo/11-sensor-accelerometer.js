// Subscribes to the accelerometer and returns the first sample.
const sensor = require("@system.sensor")

return new Promise((resolve, reject) => {
  sensor.subscribeAccelerometer({
    interval: "normal",
    callback: (res) => {
      setTimeout(() => sensor.unsubscribeAccelerometer(), 0)
      resolve(res)
    },
    fail: (data, code) =>
      reject(new Error(`sensor.subscribeAccelerometer failed, code=${code}, data=${repr(data)}`))
  })
})
