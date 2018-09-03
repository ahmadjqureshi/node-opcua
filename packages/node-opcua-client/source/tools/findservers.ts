/**
 * @module bode-opcua-client
 */
import * as async from "async";
import { assert } from "node-opcua-assert";
import * as _ from "underscore";

import { ErrorCallback } from "node-opcua-secure-channel";
import { ServerOnNetwork } from "node-opcua-service-discovery";
import { ApplicationDescription, EndpointDescription } from "node-opcua-service-endpoints";
import { OPCUAClientBase } from "../client_base";

/**
 * extract the server endpoints exposed by a discovery server
 * @method perform_findServers
 * @async
 * @param discoveryServerEndpointUri
 * @param callback
 */
export function perform_findServers(
    discoveryServerEndpointUri: string,
    callback: (err: Error | null, servers: any, endpoint: any) => void
) {

    const client = new OPCUAClientBase({});

    let servers: ApplicationDescription[] = [];
    let endpoints: EndpointDescription[] = [];

    async.series([
        (innerCallback: ErrorCallback) => {
            client.connect(discoveryServerEndpointUri, innerCallback);
        },

        (innerCallback: ErrorCallback) => {
            client.findServers((err: Error | null, _servers?: ApplicationDescription[]) => {
                if (_servers) {
                    servers = _servers;
                }
                innerCallback(err ? err : undefined);
            });
        },

        (innerCallback: ErrorCallback) => {
            client.getEndpoints({endpointUrl: undefined}, (err: Error | null, _endpoints?: EndpointDescription[]) => {
                if (_endpoints) {
                    endpoints = _endpoints;
                }
                innerCallback(err ? err : undefined);
            });
        },

    ], (err?: Error) => {
        client.disconnect(() => {
            callback(err ? err : null, servers, endpoints);
        });
    });
}

/**
 * extract the server endpoints exposed by a discovery server
 * @method perform_findServers
 * @async
 * @param discoveryServerEndpointUri
 * @param callback
 */
export function perform_findServersOnNetwork(
    discoveryServerEndpointUri: string,
    callback: (err: Error | null, servers?: ServerOnNetwork[]) => void
) {

    const client = new OPCUAClientBase({});

    client.connect(discoveryServerEndpointUri, (err?: Error) => {
        if (!err) {
            client.findServersOnNetwork((err1, servers) => {
                client.disconnect(() => {
                    callback(err1, servers);
                });
            });
        } else {
            client.disconnect(() => {
                callback(err);
            });
        }
    });
}
