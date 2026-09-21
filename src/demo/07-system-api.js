// require('@system.*') loads any feature declared in manifest.json.
const device = require("@system.device")
const vibrator = require("@system.vibrator")

vibrator.vibrate({mode: "short"})

return new Promise((resolve, reject) => {
  device.getInfo({
    success: (info) => {
      console.log("brand:", info.brand, "model:", info.model)
      console.log("screen:", info.screenWidth + "x" + info.screenHeight)
      console.log("platform:", info.platformVersionName, "API", info.APILevel)
      resolve(info)
    },
    fail: (data, code) => reject(new Error(`device.getInfo failed, code=${code}`))
  })
})
