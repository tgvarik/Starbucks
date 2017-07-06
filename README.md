# Starbucks
A Javascript interface to the (private) Starbucks ordering API


## Installing

Using npm:

```bash
$ npm install starbucks-api
```

## Usage

### Creating an instance

Once you've obtained your `client_id`, `client_secret`, and OAuth `access_token`, you can create a client:

```js
const sbux = new Client('<client id>', '<client secret>', '<access token>');
```

### Example

Every method on the client returns a promise, so they can be chained together. You can order stuff, like this:

```js
const Client = require('./lib/starbucks');
const Bluebird = require('bluebird');

const sbux = new Client('<client id>', '<client secret>', '<access token>');

Bluebird.props({
	stores: sbux.nearby_stores(),
	last_order: sbux.last_order()
}).then(result => {
	const new_cart = sbux.convert_order_to_cart(result.last_order);
	return sbux.price_order(result.stores[0].storeNumber, new_cart);
}).then(priced => {
	return sbux.cards().then(cards => {
		return sbux.place_order(priced, cards[0].cardId);
	});
}).then(result => {
	console.log(result);
}).catch(err => {
	console.log('Something went wrong!', err);
});

```
## License

MIT


