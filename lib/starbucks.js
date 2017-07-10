'use strict';

const _ = require('lodash');
const Axios = require('axios');
const Bluebird = require('bluebird');
const QueryString = require('querystring');
const Moment = require('moment');
const FS = require('fs');
const Path = require('path');

const signature = require('./signature');

class Client {

    constructor(client_key, client_secret, access_token) {
        this.client_key = client_key;
        
        this.client_secret = client_secret;
        this.access_token = access_token;

        this._authTemplate = _.template(FS.readFileSync(Path.join(__dirname, '..', 'data', 'fingerprint.template')));

        this._httpClient = Axios.create({
            baseURL: 'https://openapi.starbucks.com/v1/'
        });
    }

    authenticate(username, password) {
        const sig = signature(this.client_key, this.client_secret, Moment().unix());
        
        const url = 'oauth/token?' + QueryString.stringify({
            sig: sig,
            market: 'US',
            platform: 'Android'
        });

        const payload =  this._authTemplate({
            client_id: escape(this.client_key),
            client_secret: escape(this.client_secret),
            username: escape(username),
            password: escape(password)
        });

        return this._httpClient({
            method: 'post',
            headers: {
                'X-NewRelic-ID': 'VQUHVlNSARACVlRRAwEEVg==',
                'X-Api-Key': this.client_key,
                'User-Agent': 'Starbucks Android 4.3.9',
                'Accept': 'application/json',
                'X-Cbt': 'Uw__Rbj9JsBAd5GzffcvSGrebxJ3E6BYob18cQAVCtwtXQEAAC045VQpFypcYSwb3BKJ5zcKD7WyP575M6Sgf9LcVcI3xX86Xg==',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Host': 'openapi.starbucks.com'
            },
            url: url,
            data: payload
        }).then(response => {
            const access_token_key = 'access_token';
            const result = _.pick(response.data, access_token_key)
            this.access_token = _.get(result, access_token_key, this.access_token);
            return result;
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