'use strict';

const sinon = require('sinon');

function superagentMock() {
  const mockRequest = function mockRequest() {
    const request = sinon.stub();
    request.set = sinon.stub().returns(request);
    request.send = sinon.stub().returns(request);
    request.end = sinon.stub().yields(null, { ok: true, body: { test: '1234' } });

    request.returns(request);

    return request;
  };

  return {
    get: mockRequest(),
    post: mockRequest(),
    put: mockRequest(),
    delete: mockRequest(),
    patch: mockRequest()
  };
}

module.exports = superagentMock;

