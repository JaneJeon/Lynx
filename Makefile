.DEFAULT_GOAL := up
.PHONY: build logs sh

D=docker
DC=$(D) compose
DC_SVCS=-f docker-compose.dev.yml
DC_APP=-f docker-compose.yml
DC_ALL=$(DC_SVCS) $(DC_APP)
CONTAINER_NAME=app-container

network-up:
	$(D) network create public || true

network-down:
	$(D) network rm public || true

# TODO:
volume-up:
	$(D) volume create

# TODO:
volume-down:
	$(D) volume rm

build:
	$(DC) $(DC_APP) build

rebuild:
	$(DC) $(DC_APP) build --no-cache

up: network-up volume-up
	$(DC) $(DC_ALL) up --renew-anon-volumes --build -d

down:
	$(DC) $(DC_ALL) down --remove-orphans -v
	$(MAKE) network-down volume-down

# e.g. make logs SERVICE=app
logs:
	$(DC) $(DC_ALL) logs -f $(SERVICE)

start:
	$(D) start $(CONTAINER_NAME)

# Can't rely on docker-compose to run shell or any one-off commands, as docker compose run --rm and exec
# are both shit and do not clean up after themselves, nor do they allow you to re-use containers.
# Fucking toddlers.
sh: start
	$(D) exec -it $(CONTAINER_NAME) sh

COMMAND?=npm start
run: start
	$(D) exec $(CONTAINER_NAME) $(COMMAND)

cert:
	mkcert -install
	mkcert -cert-file config/traefik/localhost.cert.pem \
		-key-file config/traefik/localhost.key.pem \
		localhost traefik.localhost keycloak.localhost

image:
	docker build -t blink .
