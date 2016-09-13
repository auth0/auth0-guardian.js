'use strict';

const expect = require('chai').expect;
const object = require('../../lib/utils/object');

describe('utils/object', function() {

  describe('#assign', function() {
    it('assigns new values to root objects', function() {
      const root = { a: 1, b: 2 };

      expect(object.assign(root, {
        c: 3,
        d: 4
      }, {
        e: 5
      }, {
        f: 6,
        g: 7
      })).to.eql({
        a: 1,
        b: 2,
        c: 3,
        d: 4,
        e: 5,
        f: 6,
        g: 7
      });
    });
  });

  describe('#isObject', function() {
    describe('when passing an object', function() {
      it('returns true', function() {
        expect(object.isObject({ obj: 'test' })).to.be.true;
      });
    });

    describe('when passing an array', function() {
      it('returns true', function() {
        expect(object.isObject([])).to.be.true;
      });
    });

    describe('when passing an string', function() {
      it('returns false', function() {
        expect(object.isObject("test")).to.be.false;
      });
    });

    describe('when passing an number', function() {
      it('returns false', function() {
        expect(object.isObject(222)).to.be.false;
      });
    });

    describe('when passing null', function() {
      it('returns false', function() {
        expect(object.isObject(null)).to.be.false;
      });
    });
  });

  describe('#isArray', function() {
    describe('when passing an object', function() {
      it('returns false', function() {
        expect(object.isArray({ obj: 'test' })).to.be.false;
      });
    });

    describe('when passing an array', function() {
      it('returns true', function() {
        expect(object.isArray([])).to.be.true;
      });
    });

    describe('when passing an string', function() {
      it('returns false', function() {
        expect(object.isArray("test")).to.be.false;
      });
    });

    describe('when passing an number', function() {
      it('returns false', function() {
        expect(object.isArray(222)).to.be.false;
      });
    });

    describe('when passing null', function() {
      it('returns false', function() {
        expect(object.isArray(null)).to.be.false;
      });
    });

    describe('when passing undefined', function() {
      it('returns false', function() {
        expect(object.isArray(undefined)).to.be.false;
      });
    });

    describe('when passing undefined', function() {
      it('returns false', function() {
        expect(object.isArray(undefined)).to.be.false;
      });
    });
  });

  describe('#forEach', function() {
    describe('for objects', function() {
      it('iterates the items', function() {
        const collect = [];
        const obj = {
          key1: 'val1',
          key2: 'val2'
        };

        object.forEach(obj, function(value, key, obj) {
          collect.push({
            key: key,
            value: value,
            obj: obj
          });
        });

        expect(collect).to.eql([
          {
            key: 'key1',
            value: 'val1',
            obj: obj
          },
          {
            key: 'key2',
            value: 'val2',
            obj: obj
          },
        ]);
      });

      describe('for arrays', function() {
        it('iterates the client', function() {
          const collect = [];
          const array = ['value1', 'value2'];

          object.forEach(array, function(value, index, array) {
            collect.push({
              value: value,
              index: index,
              array: array
            });
          });

          expect(collect).to.eql([
            {
              value: 'value1',
              index: 0,
              array: array
            },
            {
              value: 'value2',
              index: 1,
              array: array
            }
          ])
        });
      });
    });
  });

  describe('#reduce', function() {
    describe('for objects', function() {
      it('iterates the items', function() {
        const obj = {
          key1: 'val1',
          key2: 'val2'
        };

        const collect = object.reduce(obj, function(current, value, key, obj) {
          return current.concat([{
            key: key,
            value: value,
            obj: obj,
            current: current
          }]);
        }, []);

        expect(collect).to.eql([
          {
            key: 'key1',
            value: 'val1',
            obj: obj,
            current: []
          },
          {
            key: 'key2',
            value: 'val2',
            obj: obj,
            current: [{
              key: 'key1',
              value: 'val1',
              obj: obj,
              current: []
            }]
          },
        ]);
      });

      describe('for arrays', function() {
        it('iterates the client', function() {
          const array = ['value1', 'value2'];

          const collect = object.reduce(array, function(current, value, index, array) {
            return current.concat([{
              value: value,
              index: index,
              array: array,
              current: current
            }]);
          }, []);

          expect(collect).to.eql([
            {
              value: 'value1',
              index: 0,
              array: array,
              current: []
            },
            {
              value: 'value2',
              index: 1,
              array: array,
              current: [{
                value: 'value1',
                index: 0,
                array: array,
                current: []
              }]
            }
          ])
        });
      });
    });
  });

  describe('#toArray', function() {
    describe('when input is not provided', function() {
      it('returns the input object', function() {
        expect(object.toArray(null)).to.be.null;
        expect(object.toArray(undefined)).to.be.undefined;
      });
    });

    describe('when an array-like object is provided', function() {
      it('returns an array', function() {
        expect(object.toArray({
          0: 'a',
          1: 'b',
          length: 2
        })).to.be.instanceOf(Array).and.eql([
          'a',
          'b',
        ]);
      });
    });
  });

  describe('#isIntegerString', function() {
    describe('for integer as strings', function() {
      it('returns true', function() {
        expect(object.isIntegerString('123456')).to.be.true;
      });
    });

    describe('for integers', function() {
      it('returns true', function() {
        expect(object.isIntegerString(123)).to.be.true;
      });
    });

    describe('for integer+numbers as strings', function() {
      it('returns false', function() {
        expect(object.isIntegerString('1234abc123s')).to.be.false;
      });
    });

    describe('for floats as strings (comma separated)', function() {
      it('returns false', function() {
        expect(object.isIntegerString('1234,12')).to.be.false;
      });
    });

    describe('for floats as strings (dot separated)', function() {
      it('returns false', function() {
        expect(object.isIntegerString('1234.12')).to.be.false;
      });
    });
  });

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
