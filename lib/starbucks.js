'use strict';

const _ = require('lodash');
const Axios = require('axios');
const Bluebird = require('bluebird');
const QueryString = require('querystring');

class Client {

    constructor(client_key, client_secret, access_token) {
        this.client_key = client_key;
        this.client_secret = client_secret;
        this.access_token = access_token;
        this._httpClient = Axios.create({
            baseURL: 'https://openapi.starbucks.com/v1/'
        });
    }

    _authenticatedRequest(params) {
        const options = _.merge({}, params, {
            headers: {
                Authorization: `Bearer ${this.access_token}`,
                Accept: 'application/json',
                'User-Agent': 'Starbucks Android 4.3.9'
            }
        });
        return this._httpClient(options);
    }

    nearby_stores(latitude = 40.7033, longitude = -73.9881, limit = 50, radius = 0.5) {
        const params = {
            latlng: `${latitude},${longitude}`,
            limit: limit,
            radius: radius,
            xopState: true,
            userSubMarket: 'US',
            serviceTime: true,
            locale: 'en-US'
        };
        return this._authenticatedRequest({
            method: 'get',
            url: 'stores/nearby',
            params: params
        }).then(response => {
            let stores = _.get(response, 'data.stores', []);
            stores = _.map(stores, o => _.pick(_.get(o, 'store', {}), ['id', 'name', 'storeNumber', 'address']));
            return stores;
        });
    }

    cards() {
        return this._authenticatedRequest({
            method: 'get',
            url: 'me/cards'
        }).then(response => {
            const cards = response.data;
            return _.map(cards, o => _.pick(o, ['name', 'cardId', 'cardNumber', 'nickname', 'balance']));
        });
    }

    last_order() {
        const params = {
            market: 'US',
            locale: 'en-US',
            limit: 1,
            offset: 0
        };
        return this._authenticatedRequest({
            url: 'me/orders',
            method: 'get',
            params: params
        }).then(response => {
            return _.get(response, 'data.orderHistoryItems.0.basket');
        });
    }

    convert_order_to_cart(order) {
        let preparation = _.get(order, 'preparation');
        let items = _.get(order, 'items', []);
        items = _.map(items, it => _.pick(it, ['quantity', 'commerce.sku']));
        return {
            cart: {
                offers: [],
                items: items
            },
            delivery: {
                deliveryType: preparation
            }
        };
    }

    price_order(store, cart) {
        const params = cart;
        return this._authenticatedRequest({
            method: 'post',
            url: `me/stores/${store}/priceOrder?` + QueryString.stringify({
                market: 'US',
                locale: 'en-US',
                serviceTime: true
            }),
            data: cart
        }).then(response => {
            const data = _.get(response, 'data');
            return _.pick(data, ['orderToken', 'summary.totalAmount', 'store.storeNumber', 'signature']);
        });
    }

    place_order(details, card_id) {
        const params = {
            signature: details.signature,
            tenders: [{
                amountToCharge: details.summary.totalAmount,
                type: "SVC",
                id: card_id
            }]
        };
        return this._authenticatedRequest({
            method: 'post',
            url: `me/stores/${details.store.storeNumber}/orderToken/${details.orderToken}/submitOrder?` + QueryString.stringify({
                market: 'US',
                locale: 'en-US'
            }),
            data: params
        }).then(response => {
            return _.get(response, 'data');
        });
    }

}

module.exports = Client;