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

import util from 'util'

const DEF = Symbol('definition')

type Value = boolean | number | bigint | string | symbol | object | null | undefined

export type PlainObject<T = unknown> = Record<string | number | symbol, T>

export type TypeGuard<D = unknown> = {
  // eslint-disable-next-line no-use-before-define
  [DEF]: 'typeguard' | SchemaDefinition
  /** Returns a Boolean value that indicates whether the given value has correct type. */
  validate: (value: unknown) => boolean
  /**
   * Transforms the given value into something else.
   * @experimental
   **/
  transform: (value: unknown) => unknown
  /** Configs type guard's validation function and/or transformation function. */
  config: (configs: Partial<Pick<TypeGuard<D>, 'validate' | 'transform'>>) => TypeGuard<D>
}

type TypeDefinition = TypeGuard | Value

type TypeOf<T> = T extends TypeGuard<infer D> ? D : T

/** Derives static type of the given type guard. */
export type Static<TG> = TypeOf<TG>

type SchemaDefinition = PlainObject<TypeDefinition>

// eslint-disable-next-line no-use-before-define
type Schema<D> = D extends PlainObject ? { [K in keyof D]: TypeOfSchema<TypeOf<D[K]>> } : D

type TypeOfSchema<T> = T extends Schema<infer D> ? D : T

const toString = Object.prototype.toString

export const isTypeGuard = (obj: unknown): obj is TypeGuard =>
  typeof obj === 'object' &&
  obj !== null &&
  ['string', 'object'].includes(typeof (obj as TypeGuard)[DEF]) &&
  typeof (obj as TypeGuard).validate === 'function' &&
  typeof (obj as TypeGuard).transform === 'function'

export const isPlainObject = (obj: unknown): obj is PlainObject =>
  toString.call(obj) === '[object Object]'

export const isProxy = (obj: unknown): boolean => {
  if (typeof obj !== 'object') return false
  if (typeof window !== 'undefined') {
    /* istanbul ignore next */
    try {
      window.postMessage(obj, '*')
    } catch (error) {
      return error?.code === 25
    }
    /* istanbul ignore next */
    return false
  } else {
    return util?.types?.isProxy(obj) ?? false
  }
}

const isIdenticalArray = (arr1: unknown, arr2: unknown): boolean => {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false
  if (arr1.length !== arr2.length) return false
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false
  }
  return true
}

const validateValue = (value: unknown, definition: TypeDefinition): boolean => {
  // If `definition` is a type guard
  // --------------------------------------------------------
  if (isTypeGuard(definition)) return definition.validate(value)
  // If `definition` is a specific value
  // --------------------------------------------------------
  if (Array.isArray(definition)) return isIdenticalArray(value, definition)
  if (typeof definition === 'object') {
    if (typeof value !== 'object') return false
    if (definition === null) return value === null
    if (isPlainObject(definition))
      return isPlainObject(value) && validateObject(value, definition as PlainObject<Value>)
    return definition === value
  }
  // Primitive types, function, undefined.
  return definition === value
}

const validateObject = (obj: unknown, definition: SchemaDefinition, { partial = false } = {}) => {
  // Check type
  if (typeof obj !== 'object' || obj === null) return false
  // Check keys
  const objKeys = Reflect.ownKeys(obj)
  const defKeys = Reflect.ownKeys(definition)
  if (!partial && objKeys.length !== defKeys.length) return false
  if (!objKeys.every(k => defKeys.includes(k))) return false
  // Check values
  return objKeys.every(k => {
    const value = (obj as Record<string, unknown>)[(k as unknown) as string]
    if (partial && typeof value === 'undefined') return true
    const type = definition[(k as unknown) as string]
    return validateValue(value, type)
  })
}

/**
 * @note Nested objects will not be transformed.
 */
const transformObject = (obj: unknown, definition: SchemaDefinition) => {
  if (typeof obj !== 'object' || obj === null) return obj
  const newObj = Object.create(obj)
  for (const key of Reflect.ownKeys(obj)) {
    const type = definition[(key as unknown) as string]
    const value = (obj as Record<string, unknown>)[(key as unknown) as string]
    newObj[key] = isTypeGuard(type) ? type.transform(value) : value
  }
  return newObj
}

const defaultTransformer = (value: unknown) => value

const constructor = <D>(
  validate: TypeGuard['validate'],
  transform: TypeGuard['transform'] = defaultTransformer,
  { definition = 'typeguard' }: { definition?: TypeGuard[typeof DEF] } = {}
): TypeGuard<D> =>
  Object.freeze(
    Object.assign(Object.create(null), {
      [DEF]: definition,
      validate,
      transform,
      config: c => constructor(c.validate ?? validate, c.transform ?? transform),
    } as TypeGuard<D>)
  )

export const TypeGuards = {
  //
  // Primitive types
  // -------------------------------------------------------------------------------------------
  Boolean: constructor<boolean>(value => typeof value === 'boolean'),
  /**
   * Type guard for string whose value is a boolean indicator.
   * Useful for handling query parameters, or handling data read from file.
   *
   * @example "true" | "TURE" | "1"
   **/
  StringBoolean: constructor<'true' | 'TRUE' | 'false' | 'FALSE' | '1' | '0'>(
    value => typeof value === 'string' && ['true', 'false', '1', '0'].includes(value.toLowerCase()),
    value => ['true', '1'].includes(String(value).toLowerCase())
  ),
  Number: constructor<number>(value => typeof value === 'number'),
  /** Enum type guard for `NaN`. */
  NaN: constructor<number>(value => typeof value === 'number' && Number.isNaN(value)),
  PositiveNumber: constructor<number>(value => typeof value === 'number' && value > 0),
  NegativeNumber: constructor<number>(value => typeof value === 'number' && value < 0),
  BigInt: constructor<bigint>(value => typeof value === 'bigint'),
  PositiveBigInt: constructor<bigint>(value => typeof value === 'bigint' && value > 0),
  NegativeBigInt: constructor<bigint>(value => typeof value === 'bigint' && value < 0),
  /**
   * Type guard for string whose value is a number.
   * Useful for handling query parameters, or handling data read from file.
   *
   * @example "0" | "-1" | "3.33"
   **/
  StringNumber: constructor<string>(
    value => typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value)),
    value => Number(value)
  ),
  String: constructor<string>(value => typeof value === 'string'),
  NonEmptyString: constructor<string>(value => typeof value === 'string' && !!value.trim()),
  Symbol: constructor<symbol>(value => typeof value === 'symbol'),
  /** Enum type guard for `undefined`. */
  Undefined: constructor<undefined>(value => typeof value === 'undefined'),
  /** Enum type guard for `null`. */
  Null: constructor<null>(value => value === null),
  //
  // Objects
  // -------------------------------------------------------------------------------------------
  Object: constructor<object>(value => typeof value === 'object'),
  RegExp: constructor<RegExp>(value => value instanceof RegExp),
  Map: constructor<Map<any, any>>(value => value instanceof Map),
  WeakMap: constructor<WeakMap<any, any>>(value => value instanceof WeakMap),
  Set: constructor<Set<any>>(value => value instanceof Set),
  WeakSet: constructor<WeakSet<any>>(value => value instanceof WeakSet),
  Date: constructor<Date>(value => value instanceof Date),
  StringDate: constructor<Date>(
    value => typeof value === 'string' && !Number.isNaN(Date.parse(value)),
    value => new Date(value as string)
  ),
  Promise: constructor<Promise<any>>(value => value instanceof Promise),
  Proxy: constructor<object>(isProxy),
  Array: <T extends TypeDefinition = any>(type?: T): TypeGuard<TypeOf<T>[]> =>
    constructor(
      value => {
        if (type === undefined) return Array.isArray(value)
        if (Array.isArray(value)) return value.every(v => validateValue(v, type))
        return false
      },
      value => {
        if (Array.isArray(value) && isTypeGuard(type)) return value.map(v => type.transform(v))
        return value
      }
    ),
  /**
   * Type guard for string whose value is an array with "," as delimiters.
   * Useful for handling query parameters, or handling data read from file.
   *
   * @example "item1,item2,item3"
   *
   * @param type Type guard for array items.
   * @param delimiter Delimiter used for splitting the array.
   **/
  StringArray: <T extends TypeDefinition>(type?: T, delimiter = ','): TypeGuard<string> =>
    constructor(
      value => {
        let arr
        if (typeof value === 'string') arr = value.split(delimiter)
        if (type === undefined) return Array.isArray(arr)
        if (arr) return arr.every(v => validateValue(v, type))
        return false
      },
      value => {
        if (typeof value !== 'string') return value
        const arr = value.split(delimiter)
        if (isTypeGuard(type)) return arr.map(v => type.transform(v))
        return arr
      }
    ),
  ArrayBuffer: constructor<ArrayBuffer>(value => value instanceof ArrayBuffer),
  SharedArrayBuffer: constructor<SharedArrayBuffer>(value => value instanceof SharedArrayBuffer),
  DataView: constructor<DataView>(value => value instanceof DataView),
  Int8Array: constructor<Int8Array>(
    value => value instanceof Int8Array && value.BYTES_PER_ELEMENT === 1
  ),
  Uint8Array: constructor<Uint8Array>(
    value => value instanceof Uint8Array && value.BYTES_PER_ELEMENT === 1
  ),
  Uint8ClampedArray: constructor<Uint8ClampedArray>(
    value => value instanceof Uint8ClampedArray && value.BYTES_PER_ELEMENT === 1
  ),
  Int16Array: constructor<Int16Array>(
    value => value instanceof Int16Array && value.BYTES_PER_ELEMENT === 2
  ),
  Uint16Array: constructor<Uint16Array>(
    value => value instanceof Uint16Array && value.BYTES_PER_ELEMENT === 2
  ),
  Int32Array: constructor<Int32Array>(
    value => value instanceof Int32Array && value.BYTES_PER_ELEMENT === 4
  ),
  Uint32Array: constructor<Uint32Array>(
    value => value instanceof Uint32Array && value.BYTES_PER_ELEMENT === 4
  ),
  Float32Array: constructor<Float32Array>(
    value => value instanceof Float32Array && value.BYTES_PER_ELEMENT === 4
  ),
  Float64Array: constructor<Float64Array>(
    value => value instanceof Float64Array && value.BYTES_PER_ELEMENT === 8
  ),
  BigInt64Array: constructor<BigInt64Array>(
    value => value instanceof BigInt64Array && value.BYTES_PER_ELEMENT === 8
  ),
  BigUint64Array: constructor<BigUint64Array>(
    value => value instanceof BigUint64Array && value.BYTES_PER_ELEMENT === 8
  ),
  Function: constructor<Function>(value => typeof value === 'function'),
  //
  // Schemas
  // -------------------------------------------------------------------------------------------
  Record: <
    K extends
      | Array<string | number | symbol>
      | TypeGuard<string>
      | TypeGuard<number>
      | TypeGuard<symbol>,
    V extends TypeDefinition
  >(
    keys: K,
    value: V
  ): TypeGuard<Record<K extends TypeGuard ? TypeOf<K> : string | number | symbol, TypeOf<V>>> =>
    constructor(obj => {
      // Param `keys` must be an array or a type guard
      if (!Array.isArray(keys) && !isTypeGuard(keys)) return false
      // Object being validated must be a plain object
      if (!isPlainObject(obj)) return false
      const objKeys = Reflect.ownKeys(obj)
      for (const key of objKeys) {
        // Check key
        if (isTypeGuard(keys)) {
          if (!keys.validate(key)) return false
        } else {
          const validKeys = keys.map(k => (typeof k === 'number' ? String(k) : k))
          if (!validKeys.includes(key)) return false
        }
        // Check value
        if (isTypeGuard(value)) {
          if (!value.validate(obj[key as string])) return false
        } else {
          if (value !== obj[key as string]) return false
        }
      }
      return true
    }),
  /** @param definition An object that describes the definition of Schema. */
  Schema: <D extends SchemaDefinition>(definition: D): TypeGuard<Schema<D>> =>
    constructor(
      obj => validateObject(obj, definition),
      obj => transformObject(obj, definition),
      { definition }
    ),
  /**
   * Returns a Schema type guard whose properties are all optional.
   * @param schema A schema type guard, or an object that describes the definition of Schema.
   **/
  Partial: <S extends SchemaDefinition | TypeGuard<Schema<SchemaDefinition>>>(
    schema: S
  ): TypeGuard<Partial<Schema<TypeOf<S>>>> => {
    const definition = isTypeGuard(schema) ? <SchemaDefinition>schema[DEF] : schema
    return constructor(
      obj => validateObject(obj, definition, { partial: true }),
      obj => transformObject(obj, definition),
      { definition }
    )
  },
  /**
   * Returns a Schema type guard whose properties are all required.
   * @param schema A schema type guard, or an object that describes the definition of Schema.
   **/
  Required: <S extends SchemaDefinition | TypeGuard<Schema<SchemaDefinition>>>(
    schema: S
  ): TypeGuard<Required<Schema<TypeOf<S>>>> => {
    const definition = isTypeGuard(schema) ? <SchemaDefinition>schema[DEF] : schema
    return constructor(
      obj => validateObject(obj, definition),
      obj => transformObject(obj, definition),
      { definition }
    )
  },
  /**
   * Returns a Schema type guard whose properties are picked from the given schema.
   * @param schema A schema type guard, or an object that describes the definition of Schema.
   **/
  Pick: <
    S extends SchemaDefinition | TypeGuard<Schema<SchemaDefinition>>,
    K extends keyof TypeOf<S>
  >(
    schema: S,
    keys: K[]
  ): TypeGuard<Pick<Schema<TypeOf<S>>, typeof keys[number]>> => {
    const definition = isTypeGuard(schema) ? <SchemaDefinition>schema[DEF] : schema
    const defKeys = Reflect.ownKeys(definition)
    const pickedDefinition = Object.create(definition)
    for (const k of defKeys as string[]) {
      if ((keys as string[]).includes(k)) pickedDefinition[k] = definition[k]
    }
    return constructor(
      obj => validateObject(obj, pickedDefinition),
      obj => transformObject(obj, pickedDefinition),
      { definition: pickedDefinition }
    )
  },
  //
  // Wildcards
  // -------------------------------------------------------------------------------------------
  Unknown: constructor<unknown>(() => true),
  Any: constructor<any>(() => true),
  //
  // Utils
  // -------------------------------------------------------------------------------------------
  /** @example Optional(T) = T | undefined */
  Optional: <T extends TypeDefinition>(type: T): TypeGuard<TypeOf<T> | undefined> =>
    constructor(
      value => (typeof value === 'undefined' ? true : validateValue(value, type)),
      value => (isTypeGuard(type) ? type.transform(value) : value)
    ),
  /** @example Nullable(T) = T | null */
  Nullable: <T extends TypeDefinition>(type: T): TypeGuard<TypeOf<T> | null> =>
    constructor(
      value => (value === null ? true : validateValue(value, type)),
      value => (isTypeGuard(type) ? type.transform(value) : value)
    ),
  /** @example NonNullable(T) = Exclude<T, null | undefined> */
  NonNullable: <T extends TypeDefinition>(type: T): TypeGuard<NonNullable<TypeOf<T>>> =>
    constructor(
      value => (value == null ? false : validateValue(value, type)),
      value => (isTypeGuard(type) ? type.transform(value) : value)
    ),
  /**
   * Describes value that can be one of or all of the given types.
   * @example Union(A, B, C) = A | B | C
   **/
  Union: <T extends TypeDefinition[]>(...types: T): TypeGuard<TypeOf<typeof types[number]>> =>
    constructor(
      value => types.some(type => validateValue(value, type)),
      value => {
        const type = types.find(type => validateValue(value, type))
        if (isTypeGuard(type)) return type.transform(value)
        return value
      }
    ),
  //
  // Experimental
  // -------------------------------------------------------------------------------------------
  /**
   * @reference https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions
   * @experimental
   **/
  Const: <V extends Value>(definition: V): TypeGuard<Readonly<V>> =>
    constructor(value => validateValue(value, definition)),
  /**
   * @experimental
   * @requires ES6/ES2015 or later
   **/
  GeneratorFunction: constructor<() => Generator>(
    o => typeof o === 'function' && toString.call(o) === '[object GeneratorFunction]'
  ),
  /**
   * @experimental
   * @requires ES6/ES2015 or later
   **/
  Generator: constructor<Generator>(
    o => typeof o === 'object' && o !== null && toString.call(o) === '[object Generator]'
  ),
  /**
   * @experimental
   * @requires ES8/ES2017 or later
   **/
  AsyncFunction: constructor<Function>(
    o => typeof o === 'function' && toString.call(o) === '[object AsyncFunction]'
  ),
}

export const createSchema = <D extends SchemaDefinition>(
  factory: (types: typeof TypeGuards) => D
): TypeGuard<Schema<D>> => TypeGuards.Schema(factory(TypeGuards))

export default TypeGuards
