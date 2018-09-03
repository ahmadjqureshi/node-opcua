import chalk from "chalk";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { TimestampsToReturn } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import {
    CreateMonitoredItemsRequest, CreateMonitoredItemsResponse,
    ModifyMonitoredItemsRequest, ModifyMonitoredItemsResponse,
    MonitoredItemCreateResult, MonitoredItemModifyRequest,
    MonitoredItemModifyResult,
    MonitoringMode, MonitoringParameters, MonitoringParametersOptions, SetMonitoringModeResponse
} from "node-opcua-service-subscription";
import { StatusCode, StatusCodes } from "node-opcua-status-code";

import { ClientMonitoredItemBase } from "./client_monitored_item_base";
import { SetMonitoringModeRequestLike } from "./client_session";
import { ClientSubscription } from "./client_subscription";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

/**
 * @internal
 */
export class ClientMonitoredItemToolbox {

    public static _toolbox_monitor(
        subscription: ClientSubscription,
        timestampsToReturn: TimestampsToReturn,
        monitoredItems: ClientMonitoredItemBase[],
        done: (err?: Error) => void
    ) {
        assert(_.isFunction(done));
        const itemsToCreate = [];
        for (const monitoredItem of monitoredItems) {
            const itemToCreate = monitoredItem._prepare_for_monitoring();
            if (_.isString(itemToCreate.error)) {
                return done(new Error(itemToCreate.error));
            }
            itemsToCreate.push(itemToCreate);
        }

        const createMonitorItemsRequest = new CreateMonitoredItemsRequest({
            itemsToCreate,
            subscriptionId: subscription.subscriptionId,
            timestampsToReturn,
        });

        assert(subscription.session);
        subscription.session.createMonitoredItems(
            createMonitorItemsRequest,
            (err?: Error | null, response?: CreateMonitoredItemsResponse) => {

                /* istanbul ignore next */
                if (err) {
                    debugLog(chalk.red("ClientMonitoredItemBase#_toolbox_monitor:  ERROR in createMonitoredItems "));
                } else {
                    if (!response) {
                        return done(new Error("Internal Error"));
                    }

                    response.results = response.results || [];

                    for (let i = 0; i < response.results.length; i++) {
                        const monitoredItemResult = response.results[i];
                        const monitoredItem = monitoredItems[i];
                        monitoredItem._after_create(monitoredItemResult);
                    }
                }
                done(err ? err : undefined);
            });

    }

    public static _toolbox_modify(
        subscription: ClientSubscription,
        monitoredItems: ClientMonitoredItemBase[],
        parameters: any,
        timestampsToReturn: TimestampsToReturn,
        callback: (err: Error | null, results?: MonitoredItemModifyResult[]) => void
    ) {

        assert(callback === undefined || _.isFunction(callback));

        const itemsToModify = monitoredItems.map((monitoredItem: ClientMonitoredItemBase) => {
            const clientHandle = monitoredItem.monitoringParameters.clientHandle;
            return new MonitoredItemModifyRequest({
                monitoredItemId: monitoredItem.monitoredItemId,
                requestedParameters: _.extend(_.clone(parameters), {clientHandle})
            });
        });
        const modifyMonitoredItemsRequest = new ModifyMonitoredItemsRequest({
            itemsToModify,
            subscriptionId: subscription.subscriptionId,
            timestampsToReturn,
        });

        subscription.session.modifyMonitoredItems(
            modifyMonitoredItemsRequest,
            (err: Error | null, response?: ModifyMonitoredItemsResponse) => {

                /* istanbul ignore next */
                if (err) {
                    return callback(err);
                }
                if (!response || !(response instanceof ModifyMonitoredItemsResponse)) {
                    return callback(new Error("internal error"));
                }

                response.results = response.results || [];

                assert(response.results.length === monitoredItems.length);

                const res = response.results[0];

                /* istanbul ignore next */
                if (response.results.length === 1 && res.statusCode !== StatusCodes.Good) {
                    return callback(new Error("Error" + res.statusCode.toString()));
                }
                callback(null, response.results);
            });
    }

    public static  _toolbox_setMonitoringMode(
        subscription: ClientSubscription,
        monitoredItems: ClientMonitoredItemBase[],
        monitoringMode: MonitoringMode,
        callback: (err: Error | null, statusCodes?: StatusCode[]) => void
    ) {

        const monitoredItemIds = monitoredItems.map((monitoredItem) => monitoredItem.monitoredItemId);

        const setMonitoringModeRequest: SetMonitoringModeRequestLike = {
            monitoredItemIds,
            monitoringMode,
            subscriptionId: subscription.subscriptionId,
        };

        subscription.session.setMonitoringMode(
            setMonitoringModeRequest,
            (err: Error | null, response?: SetMonitoringModeResponse) => {

                if (err) {
                    return callback(err);
                }
                if (!response) {
                    return callback(new Error("Internal Error"));
                }
                monitoredItems.forEach((monitoredItem) => {
                    monitoredItem.monitoringMode = monitoringMode;
                });
                response.results = response.results || [];
                callback(null, response.results);
            });
    }

}
