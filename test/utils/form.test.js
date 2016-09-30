'use strict';

const expect = require('chai').expect;
const formBuilder = require('../../lib/utils/form');
const Document = require('../support/document');

describe('utils/form', function () {
  let form;
  let document;

  beforeEach(function () {
    document = new Document();

    form = formBuilder({ document });
  });

  describe('#post', function () {
    beforeEach(function () {
      form.post('http://action.com', {
        a: 1,
        b: 2,
        c: 3
      });
    });

    it('adds form', function () {
      expect(document.body.children[0].type).to.equal('form');
      expect(document.body.children[0].attrs.method).to.equal('post');
      expect(document.body.children[0].attrs.action).to.equal('http://action.com');
    });

    it('adds form elements based on the fields', function () {
      const elements = document.body.children[0].children;

      expect(elements[0].type).to.equal('input');
      expect(elements[0].attrs).to.have.property('name', 'a');
      expect(elements[0].attrs).to.have.property('type', 'hidden');
      expect(elements[0].attrs).to.have.property('value', 1);

      expect(elements[1].attrs).to.have.property('name', 'b');
      expect(elements[1].attrs).to.have.property('type', 'hidden');
      expect(elements[1].attrs).to.have.property('value', 2);

      expect(elements[2].attrs).to.have.property('name', 'c');
      expect(elements[2].attrs).to.have.property('type', 'hidden');
      expect(elements[2].attrs).to.have.property('value', 3);
    });

    it('removes form when finish', function () {
      expect(document.body.children[0].removed).to.be.true;
    });

    it('submits form', function () {
      expect(document.body.children[0].submitted).to.be.true;
    });
  });
});
