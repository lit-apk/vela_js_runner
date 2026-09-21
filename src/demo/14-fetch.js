// Performs a simple GET request and returns a compact response summary.
// Docs note that fetch is unsupported on some band/watch models; in that case
// the runner will print the rejection error.
const fetch = require("@system.fetch")

return new Promise((resolve, reject) => {
  const url = "https://nimpylib.org/status/"
  fetch.fetch({
    url: url,
    method: "GET",
    responseType: "text",
    success: (res) => {
      const body = String(res.data || "")
      resolve({
        code: res.code,
        headers: res.headers,
        bodyPrefix: body.slice(0, 200),
        bodyLength: body.length
      })
    },
    fail: (data, code) => reject(new Error(`fetch.fetch for ${url} failed, code=${code}, data=${repr(data)}`))
  })
})
