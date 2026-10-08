.PHONY: install lint test build publish

install:
	@echo "Running install..."
	npm ci

lint:
	@echo "Running lint..."
	npm run lint

test:
	@echo "Running test..."
	npm test

build:
	@echo "Running build..."
	npm run dist

publish:
	@echo "Running publish..."
	npm publish
	npm run publish:cdn
