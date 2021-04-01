docker:
	docker build -f Dockerfile.test -t aqs-test-local .

test: docker
	docker run aqs-test-local npm test
