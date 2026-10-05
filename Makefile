.PHONY: install test build publish

install:
	npm install

test:
	npm test

build:
	npm run dist

publish:
	npm publish
