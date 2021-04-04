/*!
Copyright 2021 Yusipeng Xuan

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import fs from 'fs'
import path from 'path'
import type { Static, TypeGuard } from '.'
import T, { createSchema, isTypeGuard } from '.'

const tsconfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../tsconfig.json')).toString())
// For skipping type guard's validation test if the target ES version is below type guard's requirement
const target = tsconfig.compilerOptions.target.toUpperCase()

//
// Simple type guard
// -----------------------------------------------------------------------------
const defaultBanned = ['', 0, false, undefined, null, {}, []]

const regularFunction = () => undefined
const asyncFunction = async () => undefined
// eslint-disable-next-line @typescript-eslint/no-empty-function
const generatorFunction = function* () {}
const generator = generatorFunction()
const localMap = new Map()
const symbol = Symbol('key')
const SchemaA = T.Schema({ a: T.Number, b: T.String })
const SchemaB = T.Schema({ a: T.String })

const TG = {
  ...T,
  'Record(String, Number)': T.Record(T.String, T.Number),
  'Record(["a", "b"], String)': T.Record(['a', 'b'], T.String),
  'Record(["a", 1, symbol], 0)': T.Record(['a', 1, symbol], 0),
  'Array()': T.Array(),
  'Array(Number)': T.Array(T.Number),
  'Array(String)': T.Array(T.String),
  'Array("str")': T.Array('str'),
  'Array(Union(Number, String))': T.Array(T.Union(T.Number, T.String)),
  'Array(Union(0, 1))': T.Array(T.Union(0, 1)),
  'StringArray()': T.StringArray(),
  'StringArray(String)': T.StringArray(T.String),
  'StringArray(StringNumber, "|")': T.StringArray(T.StringNumber, '|'),
  'Optional(Number)': T.Optional(T.Number),
  'Optional(String)': T.Optional(T.String),
  'Optional(Null)': T.Optional(T.Null),
  'Optional([0,1,2])': T.Optional([0, 1, 2]),
  'Optional(localMap)': T.Optional(localMap),
  'Nullable(Number)': T.Nullable(T.Number),
  'Nullable(String)': T.Nullable(T.String),
  'Nullable(Undefined)': T.Nullable(T.Undefined),
  'Union(Number, String, Array())': T.Union(T.Number, T.String, T.Array()),
  'Union(Schema({ a: Number, b: String }), Schema({ a: String }))': T.Union(SchemaA, SchemaB),
  'Union(Schema({ a: Number, b: String }), { a: "true" })': T.Union(SchemaA, { a: 'true' }),
  'NonNullable(Union(String, Null))': T.NonNullable(T.Union(T.String, T.Null)),
}

type TestConfig = {
  skipValidate?: boolean
  skipTransform?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transformer?: (o: any) => unknown
}

// eslint-disable-next-line @typescript-eslint/ban-types
type Tests = [keyof typeof TG, unknown[], unknown[], TestConfig?][]

const tests: Tests = [
  ['Boolean', [true, false], [1, 'true', null, undefined, {}]],
  [
    'StringBoolean',
    ['true', 'TRUE', '1', 'false', 'FALSE', '0'],
    ['', 'T', 'F', 'yes', 'no', true, 1, false, 0, null, undefined],
    {
      transformer: (val: string | number | boolean) => ['true', 'TRUE', '1', true, 1].includes(val),
    },
  ],
  [
    'Number',
    [0, -3.333, Math.pow(2, 3), parseFloat('0.333')],
    ['0.333', true, null, undefined, {}],
  ],
  ['NaN', [NaN], [1, '1', null, undefined]],
  [
    'PositiveNumber',
    [3.333, Math.pow(2, 3), parseFloat('0.333')],
    [0, '0.333', false, null, undefined, {}],
  ],
  [
    'NegativeNumber',
    [-3.333, -Math.pow(2, 3), -parseFloat('0.333')],
    [0, '-0.333', false, null, undefined, {}],
  ],
  ['BigInt', [BigInt(0), BigInt('-1'), BigInt(true)], [0, '-1n', null, undefined, {}]],
  [
    'PositiveBigInt',
    [BigInt(true), BigInt(100)],
    [BigInt(0), BigInt('-1'), 0, '1n', null, undefined, {}],
  ],
  ['NegativeBigInt', [BigInt(-1)], [BigInt(0), BigInt('1'), 0, '-1n', null, undefined, {}]],
  ['String', ['', ' ', 'str', String(null), JSON.stringify({})], [0, false, null, undefined, {}]],
  [
    'NonEmptyString',
    ['str', String(null), JSON.stringify({})],
    ['', ' ', 0, false, null, undefined, {}],
  ],
  ['Symbol', [Symbol(''), Symbol('test')], ['', ' ', 0, false, null, undefined, {}]],
  ['Undefined', [undefined], ['', 0, false, null, {}]],
  [
    'Object',
    [
      {},
      Object.create(null),
      null,
      [],
      /test/,
      new Map(),
      new WeakMap(),
      new Set(),
      new WeakSet(),
      new Date(),
      new ArrayBuffer(0),
      new SharedArrayBuffer(0),
      new DataView(new ArrayBuffer(0)),
      new Int8Array(),
      new Float64Array(),
    ],
    ['', 0, false, undefined],
  ],
  [
    'Record(String, Number)',
    [{}, Object.create(null), { a: 0, b: 3.33 }],
    [{ a: 0, b: null }, { a: 'a' }, { a: false }, [], new Set(), ...defaultBanned.slice(0, -2)],
  ],
  [
    'Record(["a", "b"], String)',
    [{}, Object.create(null), { a: 'a' }, { a: 'a', b: '' }],
    [
      { x: 'a' }, // Key must be either 'a' or 'b'
      { a: 'a', b: null },
      { a: 1 },
      { a: false },
      [],
      new Set(),
      ...defaultBanned.slice(0, -2),
    ],
  ],
  [
    'Record(["a", 1, symbol], 0)',
    [{}, Object.create(null), { a: 0 }, { a: 0, 1: 0 }, { a: 0, 1: 0, [symbol]: 0 }],
    [
      { x: 0 }, // Key must be either 'a' or 1 or `symbol`
      { a: 1 }, // Value must be 0
      { a: 0, 1: 0, symbol: 0 },
      [],
      new Set(),
      ...defaultBanned.slice(0, -2),
    ],
  ],
  // eslint-disable-next-line prefer-regex-literals
  ['RegExp', [/test/, new RegExp('test')], defaultBanned],
  ['Map', [new Map()], [new WeakMap(), ...defaultBanned]],
  ['WeakMap', [new WeakMap()], [new Map(), ...defaultBanned]],
  ['Set', [new Set()], [new WeakSet(), ...defaultBanned]],
  ['WeakSet', [new WeakSet()], [new Set(), ...defaultBanned]],
  ['Promise', [new Promise(regularFunction)], defaultBanned],
  [
    'Generator',
    [generator],
    defaultBanned,
    { skipValidate: ['ES3', 'ES5'].includes(target), skipTransform: true },
  ],
  ['Proxy', [new Proxy({}, {}), new Proxy([], {})], defaultBanned],
  ['Date', [new Date()], defaultBanned],
  [
    'StringDate',
    ['1996-07-23', '1996/07/23', '07-23-1996', '7/23/1996', '07/23/96', '1996', '1996 Jul'],
    defaultBanned,
    { transformer: (date: string) => new Date(date) },
  ],
  ['ArrayBuffer', [new ArrayBuffer(0)], defaultBanned],
  ['SharedArrayBuffer', [new SharedArrayBuffer(0)], defaultBanned],
  ['DataView', [new DataView(new ArrayBuffer(0))], defaultBanned],
  ['Int8Array', [new Int8Array(0)], defaultBanned],
  ['Int8Array', [new Int8Array(0)], defaultBanned],
  ['Uint8Array', [new Uint8Array(0)], defaultBanned],
  ['Uint8ClampedArray', [new Uint8ClampedArray(0)], defaultBanned],
  ['Int16Array', [new Int16Array(0)], defaultBanned],
  ['Uint16Array', [new Uint16Array(0)], defaultBanned],
  ['Int32Array', [new Int32Array(0)], defaultBanned],
  ['Uint32Array', [new Uint32Array(0)], defaultBanned],
  ['Float32Array', [new Float32Array(0)], defaultBanned],
  ['Float64Array', [new Float64Array(0)], defaultBanned],
  ['BigInt64Array', [new BigInt64Array(0)], defaultBanned],
  ['BigUint64Array', [new BigUint64Array(0)], defaultBanned],
  ['Function', [regularFunction, asyncFunction, generatorFunction], defaultBanned],
  [
    'AsyncFunction',
    [asyncFunction],
    [regularFunction, generatorFunction, ...defaultBanned],
    { skipValidate: ['ES3', 'ES5', 'ES6', 'ES2015', 'ES2016'].includes(target) },
  ],
  [
    'GeneratorFunction',
    [generatorFunction],
    [regularFunction, '', 0, false, null, undefined, {}],
    { skipValidate: ['ES3', 'ES5'].includes(target) },
  ],
  ['Never', [], defaultBanned, { skipTransform: true }],
  ['Unknown', [regularFunction, asyncFunction, generatorFunction, ...defaultBanned], []],
  ['Any', [regularFunction, asyncFunction, generatorFunction, ...defaultBanned], []],
  ['Optional(Number)', [0, -1, 3.333, undefined], ['', false, null, {}, []]],
  ['Optional(String)', ['', 'a', undefined], [0, false, null, {}, []]],
  ['Optional(Null)', [null, undefined], [0, '', false, {}, []]],
  ['Optional([0,1,2])', [[0, 1, 2], undefined], ['', 0, false, null, {}, []]],
  ['Optional(localMap)', [localMap, undefined], ['', 0, false, null, {}, []]],
  ['Nullable(Number)', [0, -1, 3.333, null], ['', false, undefined, {}, []]],
  ['Nullable(String)', ['', 'a', null], [0, false, undefined, {}, []]],
  ['Nullable(Undefined)', [undefined, null], [0, '', false, {}, []]],
  [
    'Union(Number, String, Array())',
    [0, -3.33, '', 'str', [], [1, 2, 3]],
    [false, null, undefined, {}],
  ],
  [
    'Union(Schema({ a: Number, b: String }), Schema({ a: String }))',
    [{ a: 0, b: '' }, { a: '' }, { a: '', b: '' }],
    [
      { a: 0 },
      { b: '' },
      { a: false },
      { a: false, b: '' },
      { a: 0, b: false },
      { a: 0, b: '', c: 3 },
      defaultBanned,
    ],
  ],
  [
    'Union(Schema({ a: Number, b: String }), { a: "true" })',
    [{ a: 0, b: '' }, { a: 'true' }, { a: 'true', b: '' }],
    [
      { a: 1 },
      { a: '' },
      { a: true },
      { b: '' },
      { a: '', b: '' },
      { a: false },
      { a: false, b: '' },
      { a: 0, b: false },
      { a: 0, b: '', c: 3 },
      defaultBanned,
    ],
  ],
  ['NonNullable(Union(String, Null))', ['', 'a'], defaultBanned.slice(1)],
]

const defaultTransformer = (value: unknown) => value

describe.each(tests)(
  '%s',
  (
    type,
    allowedValues,
    bannedValues,
    { skipValidate, skipTransform, transformer = defaultTransformer } = {}
  ) => {
    const TypeGuard = TG[type] as TypeGuard<unknown>

    if (!skipValidate && allowedValues.length > 0) {
      test.each(allowedValues)('correctly validates:   %p', value => {
        expect(TypeGuard.validate(value)).toBe(true)
      })
    }

    if (bannedValues.length > 0) {
      test.each(bannedValues)('correctly invalidates: %p', value => {
        expect(TypeGuard.validate(value)).toBe(false)
      })
    }

    if (!skipTransform) {
      test.each(allowedValues)('correctly transforms:  %p', value => {
        expect(TypeGuard.transform(value)).toEqual(
          typeof transformer === 'function' ? transformer(value) : value
        )
      })
    }
  }
)

//
// Array type guard
// -----------------------------------------------------------------------------
const stringArrayTransformer = (str: string) => str.split(',')

const arrayTests: Tests = [
  [
    'Array()',
    [[], [1, 3.33], ['', 'a'], [true], [1, 'a', true]],
    [new Set(), new ArrayBuffer(0), ...defaultBanned.slice(0, -1)],
  ],
  ['Array(Number)', [[], [1, 3.33]], [['', 'a'], [1, 'a', true], ...defaultBanned.slice(0, -1)]],
  ['Array(String)', [[], ['', 'a']], [[1, 3.33], [1, 'a', true], ...defaultBanned.slice(0, -1)]],
  [
    'Array("str")',
    [[], ['str'], ['str', 'str']],
    [[''], ['str', ''], ...defaultBanned.slice(0, -1)],
  ],
  [
    'Array(Union(Number, String))',
    [[], [1, 3.33], ['', 'a'], [1, 'a']],
    [[1, 'a', true], new Set(), new ArrayBuffer(0), ...defaultBanned.slice(0, -1)],
  ],
  [
    'Array(Union(0, 1))',
    [[], [0], [1], [0, 1], [0, 1, 0, 0, 1, 1]],
    [[0, 1, 2], ...defaultBanned.slice(0, -1)],
  ],
  [
    'StringArray()',
    ['1,2,3.33', 'a,b,str', 'true,2,str'],
    defaultBanned.slice(1),
    { transformer: stringArrayTransformer },
  ],
  [
    'StringArray(String)',
    ['1,2,3.33', 'a,b,str', 'true,2,str'],
    defaultBanned.slice(1),
    { transformer: stringArrayTransformer },
  ],
]

const arrToDict = (arr: unknown[]): Record<string, unknown[]> => {
  const dict = Object.create(null)
  for (const item of arr) {
    dict[JSON.stringify(item)] = item
  }
  return dict
}

describe.each(arrayTests)(
  '%s',
  (type, allowedValues, bannedValues, { skipTransform, transformer = defaultTransformer } = {}) => {
    const TypeGuard = TG[type] as TypeGuard<unknown>

    const allowedValueDict = arrToDict(allowedValues)
    const allowedKeys = Object.keys(allowedValueDict)
    const bannedValueDict = arrToDict(bannedValues)
    const bannedKeys = Object.keys(bannedValueDict)

    test.each(allowedKeys)('correctly validates:   %s', key => {
      expect(TypeGuard.validate(allowedValueDict[key as string])).toBe(true)
    })

    if (bannedValues.length > 0) {
      test.each(bannedKeys)('correctly invalidates: %s', key => {
        expect(TypeGuard.validate(bannedValueDict[key as string])).toBe(false)
      })
    }

    if (!skipTransform) {
      test.each(allowedKeys)('correctly transforms:  %s', key => {
        const value = allowedValueDict[key as string]
        expect(TypeGuard.transform(value)).toEqual(
          typeof transformer === 'function' ? transformer(value) : value
        )
      })
    }
  }
)

// Complementary tests
describe('StringArray(StringNumber, "|")', () => {
  it.each(['1,2,3', 'a|b|str', 'true|2|str'])('correctly invalidates: %s', str => {
    expect(TG['StringArray(StringNumber, "|")'].validate(str)).toBe(false)
  })

  it('correctly validates:   1|2|3.33', () => {
    expect(TG['StringArray(StringNumber, "|")'].validate('1|2|3.33')).toBe(true)
  })

  it('correctly transforms:  1|2|3.33', () => {
    expect(TG['StringArray(StringNumber, "|")'].transform('1|2|3.33')).toEqual([1, 2, 3.33])
  })
})

describe('Never', () => {
  it.each(defaultBanned)('correctly transforms:  %p', value => {
    expect(T.Never.transform(value)).toBe(undefined)
  })
})

//
// Custom type guard
// -----------------------------------------------------------------------------
// Custom number-based type guard
describe('CustomNumberRange', () => {
  const CustomNumberRange = T.Number.config({
    validate: value => typeof value === 'number' && value > 0 && value < 3,
  })

  it('correctly validates number within the range', () => {
    expect(CustomNumberRange.validate(1)).toBe(true)
    expect(CustomNumberRange.validate(2)).toBe(true)
  })

  it("correctly invalidates number that's out of range", () => {
    expect(CustomNumberRange.validate(0)).toBe(false)
    expect(CustomNumberRange.validate(3)).toBe(false)
  })

  it("correctly invalidates value that's not a number", () => {
    expect(CustomNumberRange.validate('1')).toBe(false)
    expect(CustomNumberRange.validate(true)).toBe(false)
    expect(CustomNumberRange.validate([])).toBe(false)
  })
})

//
// Complex type guard
// -----------------------------------------------------------------------------
const Age = T.Number.config({ validate: v => typeof v === 'number' && v >= 0 })

const definition = {
  title: T.String,
  salary: T.Nullable(T.Number),
}

// Custom schema
const JobSchema = T.Schema(definition)

// Use closure to use type guard directly & prevent naming conflicts with JS built-in objects
const PersonSchema = createSchema(({ Boolean, String, Number, Array, Optional, Union }) => ({
  name: String,
  age: Age,
  alive: Boolean,
  address: Optional(String),
  // Support complex nested type guard
  favorites: Array(Union(String, Number)),
  // Support nested schema
  job: JobSchema,
}))

// Support static type, so that type guard is never out of sync
const person: Static<typeof PersonSchema> = {
  name: 'John Doe',
  age: 23,
  alive: true,
  address: undefined,
  favorites: ['cat', 'dog', 7],
  job: {
    title: 'Dreamer',
    salary: null,
  },
}

describe('Schema', () => {
  it('correctly validates object', () => {
    expect(PersonSchema.validate(person)).toBe(true)
  })

  it("correctly validates object whose property do pass embedded custom type guard's validation", () => {
    // Address is optional
    expect(PersonSchema.validate({ ...person, address: undefined })).toBe(true)
  })

  it('correctly invalidates object with incorrect property type', () => {
    expect(PersonSchema.validate({ ...person, name: undefined })).toBe(false)
    expect(PersonSchema.validate({ ...person, age: '23' })).toBe(false)
  })

  it("correctly invalidates object whose property doesn't pass embedded custom type guard's validation", () => {
    // Age must be greater than or equal to 0
    expect(PersonSchema.validate({ ...person, age: -1 })).toBe(false)
  })

  it('correctly invalidates object with unwanted properties', () => {
    expect(PersonSchema.validate({ ...person, extra: undefined })).toBe(false)
    expect(PersonSchema.validate({ ...person, extra1: undefined, extra2: null })).toBe(false)
  })

  it('correctly transforms object', () => {
    expect(PersonSchema.transform(person)).toEqual(person)
  })

  it('correctly returns schema definition using `definition` API', () => {
    expect(JobSchema.definition()).toEqual(definition)
  })

  it('correctly returns indexed access type definition using `definition` API', () => {
    const Title = JobSchema.definition('title') as TypeGuard
    expect(isTypeGuard(Title)).toBe(true)
    expect(Title.validate('')).toBe(true)
    expect(Title.definition('key')).toBe(undefined)
  })
})

// Pick from type guard
const CatSchema = T.Pick(PersonSchema, ['name', 'age', 'alive'])
// Pick from schema object
const DogSchema = T.Pick(
  {
    name: T.String,
    age: Age,
    alive: T.Boolean,
    address: T.Optional(T.String),
  },
  ['name', 'age', 'alive']
)

const cat: Static<typeof CatSchema> = {
  name: 'Baby',
  age: 5,
  alive: true,
}
const dog: Static<typeof DogSchema> = { ...cat, name: 'Bruno' }

describe('Pick', () => {
  it('correctly validates object', () => {
    expect(CatSchema.validate(cat)).toBe(true)
    expect(DogSchema.validate(dog)).toBe(true)
  })

  it('correctly invalidates object with incorrect property type', () => {
    expect(CatSchema.validate({ ...cat, name: undefined })).toBe(false)
    expect(CatSchema.validate({ ...cat, age: '24' })).toBe(false)
    expect(DogSchema.validate({ ...dog, name: undefined })).toBe(false)
    expect(DogSchema.validate({ ...dog, age: '24' })).toBe(false)
  })

  it('correctly invalidates object with unwanted properties', () => {
    expect(CatSchema.validate({ ...cat, extra: undefined })).toBe(false)
    expect(CatSchema.validate({ ...cat, extra1: undefined, extra2: null })).toBe(false)
    expect(DogSchema.validate({ ...dog, extra: undefined })).toBe(false)
    expect(DogSchema.validate({ ...dog, extra1: undefined, extra2: null })).toBe(false)
  })

  it('correctly transforms object', () => {
    expect(CatSchema.transform(cat)).toEqual(cat)
  })
})

const AlienDogSchema = T.Omit(DogSchema, ['alive'])
const alienDog: Static<typeof AlienDogSchema> = {
  name: 'Snow Ball',
  age: 99,
}

describe('Omit', () => {
  it('correctly validates object', () => {
    expect(AlienDogSchema.validate(alienDog)).toBe(true)
    expect(AlienDogSchema.validate(dog)).toBe(false)
  })

  it('correctly invalidates object with incorrect property type', () => {
    expect(AlienDogSchema.validate({ age: 99 })).toBe(false)
    expect(AlienDogSchema.validate({ ...alienDog, age: '24' })).toBe(false)
  })

  it('correctly invalidates object with unwanted properties', () => {
    expect(AlienDogSchema.validate({ ...alienDog, extra: undefined })).toBe(false)
    expect(AlienDogSchema.validate({ ...alienDog, extra1: undefined, extra2: null })).toBe(false)
  })

  it('correctly transforms object', () => {
    expect(AlienDogSchema.transform(alienDog)).toEqual(alienDog)
  })
})

const PartialPersonSchema = T.Partial(PersonSchema)

describe('Partial', () => {
  it('correctly validates object with every property presented', () => {
    expect(PartialPersonSchema.validate(person)).toBe(true)
  })

  it('correctly validates object with only some of the properties presented', () => {
    expect(PartialPersonSchema.validate({ name: 'Sam' })).toBe(true)
    expect(PartialPersonSchema.validate({ age: 23, alive: false })).toBe(true)
  })

  it('correctly invalidates object with incorrect property type', () => {
    expect(PartialPersonSchema.validate({ ...person, name: false })).toBe(false)
    expect(PartialPersonSchema.validate({ ...person, age: '24' })).toBe(false)
  })

  it('correctly invalidates object with unwanted properties', () => {
    expect(PartialPersonSchema.validate({ ...person, extra: undefined })).toBe(false)
    expect(PartialPersonSchema.validate({ ...person, extra1: undefined, extra2: null })).toBe(false)
  })

  it('correctly transforms object', () => {
    expect(PartialPersonSchema.transform(person)).toEqual(person)
  })
})

const RequiredPersonSchema = T.Required(PartialPersonSchema)

describe('Required', () => {
  it('correctly validates object', () => {
    expect(RequiredPersonSchema.validate(person)).toBe(true)
  })

  it('correctly invalidates object with missing properties', () => {
    const { name: _1, ...person1 } = person
    const { name: _2, age: _3, ...person2 } = person
    expect(RequiredPersonSchema.validate(person1)).toBe(false)
    expect(RequiredPersonSchema.validate(person2)).toBe(false)
  })

  it('correctly invalidates object with incorrect property type', () => {
    expect(RequiredPersonSchema.validate({ ...person, name: undefined })).toBe(false)
    expect(RequiredPersonSchema.validate({ ...person, age: '24' })).toBe(false)
  })

  it('correctly invalidates object with unwanted properties', () => {
    expect(RequiredPersonSchema.validate({ ...person, extra: undefined })).toBe(false)
    expect(RequiredPersonSchema.validate({ ...person, extra1: undefined, extra2: null })).toBe(
      false
    )
  })

  it('correctly transforms object', () => {
    expect(RequiredPersonSchema.transform(person)).toEqual(person)
  })
})

//
// Experimental type guard
// -----------------------------------------------------------------------------
describe('Const', () => {
  const ConstNull = T.Const(null)

  it('correctly validates null', () => {
    expect(ConstNull.validate(null)).toBe(true)
  })

  it('correctly invalidates non-null value', () => {
    expect(ConstNull.validate(0)).toBe(false)
    expect(ConstNull.validate(undefined)).toBe(false)
    expect(ConstNull.validate(false)).toBe(false)
  })

  const ConstNumber = T.Const(3.33)

  it('correctly validates identical number', () => {
    expect(ConstNumber.validate(3.33)).toBe(true)
  })

  it('correctly invalidates nonidentical number', () => {
    expect(ConstNumber.validate(3.333)).toBe(false)
    expect(ConstNumber.validate(3)).toBe(false)
    expect(ConstNumber.validate('3.33')).toBe(false)
    expect(ConstNumber.validate(true)).toBe(false)
  })

  const arr = [1, 'a', true]
  const ConstArray = T.Const(arr)

  it('correctly validates identical array', () => {
    // deep clone
    const identicalArray = JSON.parse(JSON.stringify(arr))
    expect(ConstArray.validate(identicalArray)).toBe(true)
  })

  it('correctly invalidates nonidentical array', () => {
    expect(ConstArray.validate([0, 'a', true])).toBe(false)
    expect(ConstArray.validate([1, '', true])).toBe(false)
    expect(ConstArray.validate([1, 'a', false])).toBe(false)
    expect(ConstArray.validate([1, 'a', true, null])).toBe(false)
    expect(ConstArray.validate([1, 'a'])).toBe(false)
    expect(ConstArray.validate([])).toBe(false)
  })

  const obj = { nested: { value: 0 } }
  const ConstObject = T.Const(obj)

  it('correctly validates identical object', () => {
    // deep clone
    const identicalObj = JSON.parse(JSON.stringify(obj))
    expect(ConstObject.validate(identicalObj)).toBe(true)
  })

  it('correctly invalidates nonidentical object', () => {
    expect(ConstObject.validate({ nested: { value: 999 } })).toBe(false)
    expect(ConstObject.validate({ nested: null })).toBe(false)
    expect(ConstObject.validate({})).toBe(false)
  })
})
