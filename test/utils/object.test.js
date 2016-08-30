'use strict';

const expect = require('chai').expect;
const object = require('../../lib/utils/object');

describe('utils/object', function() {

  describe('#mapKeyValue', function() {

    describe('for array', function() {

      it('maps index and values', function() {
        expect(object.mapKeyValue([
            { value: 1 },
            { value: 2 },
            { value: 3 },
            { value: 4, obj: { value: 2 } }
          ],
          (key, value) => key + 1,
          (key, value) => value.value
        ).slice(1))
        .eql([1, 2, 3, 4]);
      });
    });

    describe('for object', function() {
      it('maps keys and values', function() {
        expect(object.mapKeyValue({
            key1: 'value1',
            key2: 'value2',
            key3: 'value3'
          },
          (key, value) => key.toUpperCase(),
          (key, value) => value.toUpperCase()
        ))
        .eql({
          KEY1: 'VALUE1',
          KEY2: 'VALUE2',
          KEY3: 'VALUE3'
        });
      });
    });
  });

  describe('#toCamelKeys', function() {

    it('camelizes keys', function() {
      expect(object.toCamelKeys({
        snake_key: 'hello1',
        'kebab-case': 'hello2',
        camelCase: 'hello3',
        object: {
          snake_key: 'hello1',
          'kebab-case': 'hello2',
          camelCase: 'hello3',
        },
        array: [1, 2, {
          snake_key: 'hello1',
          'kebab-case': 'hello2',
          camelCase: 'hello3',
        }]
      })).to.eql({
        snakeKey: 'hello1',
        kebabCase: 'hello2',
        camelCase: 'hello3',
        object: {
          snakeKey: 'hello1',
          kebabCase: 'hello2',
          camelCase: 'hello3',
        },
        array: [1, 2, {
          snakeKey: 'hello1',
          kebabCase: 'hello2',
          camelCase: 'hello3',
        }]
      });
    });
  });

  describe('#toSnakeKeys', function() {

    it('snakerizes keys', function() {
      expect(object.toSnakeKeys({
        snake_key: 'hello1',
        'kebab-case': 'hello2',
        camelCase: 'hello3',
        object: {
          snake_key: 'hello1',
          'kebab-case': 'hello2',
          camelCase: 'hello3',
        },
        array: [1, 2, {
          snake_key: 'hello1',
          'kebab-case': 'hello2',
          camelCase: 'hello3',
        }]
      })).to.eql({
        snake_key: 'hello1',
        kebab_case: 'hello2',
        camel_case: 'hello3',
        object: {
          snake_key: 'hello1',
          kebab_case: 'hello2',
          camel_case: 'hello3',
        },
        array: [1, 2, {
          snake_key: 'hello1',
          kebab_case: 'hello2',
          camel_case: 'hello3',
        }]
      });
    });
  });

});
