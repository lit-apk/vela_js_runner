// A runtime error: the stack trace from QuickJS is displayed.
function inner(x) {
  return x.missing.prop
}
function outer() {
  return inner(undefined)
}
console.log("about to throw...")
outer()
