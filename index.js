const eeiMethods = [
  { name: 'getGasLeft', args: [], ret: 'i64' },
  { name: 'getBlockGasLimit', args: [], ret: 'i64' },
  { name: 'getTxGasPrice', args: [ 'resultOffset' ] },
  { name: 'getBlockNumber', args: [], ret: 'i64' },
  { name: 'callValue', args: [ 'resultOffset' ] },
  { name: 'return', args: [ 'memOffset', 'memLength' ] },
  { name: 'revert', args: [ 'memOffset', 'memLength' ] },
  { name: 'call', args: [ 'i64', 'addressOffset', 'valueOffset', 'memOffset', 'memLength' ], ret: 'i32' }
]

const eeiTypes = {
  i32: { wasmType: 'i32' },
  i64: { wasmType: 'i64' },
  memOffset: { wasmType: 'i32' },
  memLength: { wasmType: 'i32' },
  resultOffset: { wasmType: 'i32' },
  addressOffset: { wasmType: 'i32' },
  valueOffset: { wasmType: 'i32' }
}

// from https://stackoverflow.com/a/1527820
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomizeArgument(argType, locals32, locals64) {
  const wasmType = eeiTypes[argType].wasmType
  // FIXME: support 64bits properly
  // FIXME: support negative range
  const minValue = eeiTypes[argType].minValue || (wasmType === 'i32' ? 0 : 0) // (−2147483647) : (−9223372036854775808))
  const maxValue = eeiTypes[argType].maxValue || (wasmType === 'i32' ? 2147483647 : 9223372036854775807)

  if (getRandomInt(0, 65536) & 1) {
    // assume locals32.length === locals64.length
    const varName = `$l${wasmType}_${getRandomInt(0, locals32.length)}`
    return `(get_local ${varName})`
  } else {
    return `(${wasmType}.const ${getRandomInt(minValue, maxValue)})`
  }
}

function randomizeReturn(statement, retType, locals32, locals64) {
  // FIXME: improve randomization
  const range = (locals32.length + locals64.length) * 2
  const choice = getRandomInt(0, range)
  if (choice <= locals32.length) {
    const varName = `$li32_${choice}`
    return `(set_local $${varName} ${statement})`
  } else if (choice >= (range - locals64.length)) {
    const varName = `$li64_${range - choice}`
    return `(set_local $${varName} ${statement})`
  } else {
    return `(drop ${statement})`
  }
}

function generateSingleCall(method, locals32, locals64) {
  let args = []
  for (let i in method.args) {
    const argType = method.args[i]
    args.push(randomizeArgument(argType, locals32, locals64))
  }
  const callStatement = `(call $${method.name} ${args.join(' ')})`
  if (method.ret) {
    return randomizeReturn(callStatement, method.ret, locals32, locals64)
  } else {
    return callStatement
  }
}

function generateSingleRandomCall(locals32, locals64) {
  const method = eeiMethods[ (Math.random() * eeiMethods.length) | 0 ]
  return generateSingleCall(method, locals32, locals64)
}

function generateTest(numCalls = 8) {
  let imports = []
  for (let eeiMethodIndex in eeiMethods) {
    const eeiMethod = eeiMethods[eeiMethodIndex]

    let args = []
    for (let i = 0; i < eeiMethod.args.length; i++) {
      args.push(eeiTypes[eeiMethod.args[i]].wasmType)
    }
    if (args.length > 0) {
      args = `(param ${args.join(' ')})`
    } else {
      args = ''
    }

    let ret = ''
    if (eeiMethod.ret) {
      ret = `(result ${eeiTypes[eeiMethod.ret].wasmType})`
    }

    imports.push(`(import "ethereum" "${eeiMethod.name}" (func $${eeiMethod.name} ${args} ${ret}))`)
  }

  // generate 8 32-bit and 8 64-bit locals (will be used randomly)
  let locals = []
  let locals32 = []
  for (let i = 0; i < 8; i++) {
    const name = `li32_${i}`
    locals32.push(name)
    locals.push(`(local $${name} i32)`)
  }
  let locals64 = []
  for (let i = 0; i < 8; i++) {
    const name = `li64_${i}`
    locals32.push(name)
    locals.push(`(local $${name} i64)`)
  }

  // generate random EEI calls numCalls times
  let calls = []
  for (let i = 0; i < numCalls; i++) {
    calls.push(generateSingleRandomCall(locals32, locals64))
  }

  return `(module
    ${imports.join('')}

    (memory 1)
    (export "memory" (memory 0))

    (func $main
      (export "main")
      ${locals.join('')}
      ${calls.join('')}
    )
  )`
}

console.log(generateTest())
