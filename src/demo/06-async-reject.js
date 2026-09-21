// A rejected Promise is reported as an error.
return new Promise((resolve, reject) => {
  setTimeout(() => reject(new RangeError("rejected after 200 ms")), 200)
})
