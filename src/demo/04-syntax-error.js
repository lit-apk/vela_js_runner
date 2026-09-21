// A compile-time error: SyntaxError is reported without running anything.
const x = 1
if (x > 0 {
  console.log("never reached")
}
