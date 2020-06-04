const amqp = require("amqplib");
const { promisify } = require("util");

const sleep = promisify(setTimeout);

const main = async () => {
  const client = await amqp.connect("amqp://admin:password@localhost");
  const channel = await client.createChannel();

  channel.prefetch(1);

  const ratePerSecond = 120;
  const tokenBucket = "token_bucket";
  const jobQueue = "job_queue";

  await channel.assertQueue(tokenBucket, {
    maxLength: ratePerSecond,
    durable: true,
  });

  await channel.assertQueue(jobQueue, {
    durable: true,
  });

  setInterval(() => {
    channel.sendToQueue(tokenBucket, Buffer.from(new Date().toISOString()), {
      persistent: true,
    });
  }, 100);

  channel.consume(jobQueue, async (message) => {
    const token = await channel.get(tokenBucket);

    if (!token) {
      await sleep(1000);
      channel.nack(message);
      console.log("nack", message.content.toString());
      return;
    }

    channel.ack(token);

    console.log("ack", message.content.toString());

    channel.ack(message);
  });

  for (let i = 0; i < 1000; i++) {
    channel.sendToQueue(jobQueue, Buffer.from(`Messages ${i}`), {
      persistent: true,
    });
  }
};

main()
  .then(() => {
    console.log("worker start");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
