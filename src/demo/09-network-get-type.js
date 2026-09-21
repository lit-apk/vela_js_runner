// Calls network.getType and returns its result.
const network = require("@system.network")

return new Promise((resolve, reject) => {
  network.getType({
    success: resolve,
    fail: (data, code) => reject(new Error(`network.getType failed, code=${code}, data=${repr(data)}`))
  })
})
