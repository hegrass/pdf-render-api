const puppeteer = require("puppeteer-extra").use(require("puppeteer-extra-plugin-stealth")());
const genericPool = require("generic-pool");

const initPuppeteerPool = (
    {
        max = 3,
        min = 1,
        idleTimeoutMillis = 30000,
        maxUses = 50,
        testOnBorrow = true,
        puppeteerArgs = {},
        validator = () => Promise.resolve(true)
    } = {}
) => {
    const factory = {
        create: () =>
            puppeteer.launch(puppeteerArgs).then(
                instance => {
                    instance.useCount = 0;
                    return instance;
                }
            ),
        destroy: instance => {
            instance.close();
        },
        validate: instance => {
            return validator(instance).then(valid =>
                Promise.resolve(valid && (maxUses <= 0 || instance.useCount < maxUses))
            );
        }
    };

    const pool = genericPool.createPool(factory, {
        max,
        min,
        idleTimeoutMillis,
        testOnBorrow
    });

    const genericAcquire = pool.acquire.bind(pool);

    pool.acquire = () =>
        genericAcquire().then(
            instance => {
                instance.useCount++;
                return instance;
            }
        );

    pool.use = fn => {
        let resource = null;

        return pool
            .acquire()
            .then(
                r => {
                    resource = r;
                    return resource;
                }
            )
            .then(fn)
            .then(
                result => {
                    pool.release(resource);
                    return result;
                },
                err => {
                    pool.release(resource);
                    throw err;
                }
            );
    };

    return pool;
};

module.exports = initPuppeteerPool;
