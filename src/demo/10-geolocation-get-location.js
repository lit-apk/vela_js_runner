// Calls geolocation.getLocation and returns its result.
const geolocation = require("@system.geolocation")

return new Promise((resolve, reject) => {
  geolocation.getLocation({
    timeout: 4000,
    success: resolve,
    fail: (data, code) =>
      reject(new Error(`geolocation.getLocation failed, code=${code}, data=${repr(data)}`))
  })
})
