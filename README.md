# TypeGuards

[![build](https://github.com/Lchemist/TypeGuards/workflows/build/badge.svg)](https://github.com/Lchemist/TypeGuards/actions?query=workflow%3Abuild)
[![NPM](https://img.shields.io/npm/v/@typeguards/core.svg)](https://www.npmjs.com/package/@typeguards/core)
[![Coverage Status](https://img.shields.io/codecov/c/github/Lchemist/TypeGuards/main.svg)](https://codecov.io/gh/Lchemist/TypeGuards/branch/main)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](https://commitizen.github.io/cz-cli/)
[![Conventional Changelog](https://img.shields.io/badge/changelog-conventional-brightgreen.svg)](https://conventional-changelog.github.io)

Runtime type checking library for TypeScript & JavaScript.

## ✨ Features

* Provides runtime type validation.
* Can derive static type from any type guard, thus types are never out of sync.
* Supports nested type guards.
* Supports almost all JS data types, including Promise, Proxy, DataView and typed arrays.
* Package has 0 dependency.

## 📦 Installation

```bash
# npm
npm install @typeguards/core
# yarn
yarn add @typeguards/core
```

## 🔨 Usage

### Basics
```ts
import T from '@typeguards/core'

T.Number.validates(1) // true
T.Number.validates('1') // false
T.Optional(T.String).validates('1') // true
T.Optional(T.String).validates(undefined) // true
T.Optional(T.String).validates(1) // false

// Custom type guard
const Range = T.Number.config({
  // Custom validation function
  validate: value => typeof value === 'number' && value > 0 && value < 3,
})
Range.validate(0) // false
Range.validate(1) // true
Range.validate(2) // true
Range.validate(3) // false
```

### Schema
```ts
import type { Static } from '@typeguards/core'
import T, { createSchema } from '@typeguards/core'

const Age = T.Number.config({ validate: v => typeof v === 'number' && v >= 0 })

// Custom schema
const JobSchema = T.Schema({
  title: T.String,
  salary: T.Nullable(T.Number),
})

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

// Support static type derivation, thus type is never out of sync
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

PersonSchema.validate(person) // true
PersonSchema.validate({ ...person, address: undefined }) // true, because address is optional
PersonSchema.validate({ ...person, name: undefined }) // false
PersonSchema.validate({ ...person, age: '23' }) // false

const CatSchema = T.Partial(T.Pick(PersonSchema, ['name', 'age', 'alive']))
// Equivalent to Partial<Pick<PersonType, 'name' | 'age' | 'alive'>>
type Cat = Static<typeof CatSchema>

CatSchema.validate(person) // false
CatSchema.validate({ name: 'Baby', age: undefined }) // true
```

### Transformer (Experimental Feature)
```ts
import T from '@typeguards/core'

// Customize transformation function
const Name = T.String.config({ transform: val => `${val} Jr.` })
const Alive = T.Boolean.config({ transform: val => val ?? true })
const Person = T.Partial(T.Schema({ name: Name, alive: Alive }))

const john = { name: 'John' }
Person.validate(john) // true
const johnJr = Person.transform(john) // { name: 'John Jr.', alive: true }
```

## 🛡️ List of type guards

| name              | description                                                                                            
|-------------------|--------------------------------------------------------------------------------------------------------
| Boolean           | 
| StringBoolean     | "true" \| "TRUE" \| "false" \| "FALSE" \| "1" \| "0"
| Number            |
| NaN               | `NaN`
| PositiveNumber    | A number value that's greater than 0
| NegativeNumber    | A number value that's less than 0
| BigInt            |
| PositiveBigInt    | A BigInt value that's greater than 0
| NegativeBigInt    | A BigInt value that's less than 0
| StringNumber      | A string whose value is a number, such as "0", "-1", "3.333"
| String            |
| NonEmptyString    | A string that's not empty even after trimming
| Symbol            | 
| Undefined         | `undefined`
| Null              | `null`
| Object            | An object (Any object will qualify as long as `typeof obj === 'object'`)
| RegExp            | 
| Map               |
| WeakMap           |
| Set               |
| WeakSet           |
| Promise           |
| Proxy             |
| Date              |
| StringDate        | A correctly formatted date string, such as "1996-07-23", "1996/07/23", "1996 Jul", "1996" 
| Array             | 
| StringArray       | A string whose value is an array separated by delimiter "," (delimiter is customizable)
| ArrayBuffer       |
| SharedArrayBuffer |
| DataView          |
| Int8Array         |
| Uint8Array        |
| Uint8ClampedArray |
| Int16Array        |
| Uint16Array       |
| Int32Array        |
| Uint32Array       |
| Float32Array      |
| Float64Array      |
| BigInt64Array     |
| BigUint64Array    | 
| Function          | A function
| Record            | Equivalent of TypeScript `Record` type
| Schema            | A plain object
| Partial           | Equivalent of TypeScript `Partial` type
| Required          | Equivalent of TypeScript `Required` type
| Pick              | Equivalent of TypeScript `Pick` type
| Unknown           | Equivalent of TypeScript `unknown` type
| Any               | Equivalent of TypeScript `any` type
| Optional          | T \| undefined
| Nullable          | T \| null
| NonNullable       | Equivalent of TypeScript `NonNullable` type
| Union             | Equivalent of TypeScript union type
| Const             | Equivalent of TypeScript const assertion
| GeneratorFunction | Requires ES6/ES2015 or later
| Generator         | Requires ES6/ES2015 or later
| AsyncFunction     | Requires ES8/ES2017 or later

## 📜 License

[Apache License 2.0](/LICENSE)