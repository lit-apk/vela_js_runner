// A returned Promise is awaited; its settled value becomes the result.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
return (async () => {
  console.log("start")
  await sleep(300)
  console.log("after 300 ms")
  await sleep(300)
  return {elapsedRoughly: 600, ok: true}
})()
