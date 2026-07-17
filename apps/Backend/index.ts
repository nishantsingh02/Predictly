import "dotenv/config";
import express from "express";
import cors from "cors";
import { middleware } from "./middleware";
import { prisma } from "db";
import { CreateOrderSchema, SplitSchema, MergeSchema } from "./types";
import type { Orderbook } from "./types";
import { uuid } from "uuidv4";

const app = express();

app.use(express.json());
app.use(cors());

// handels both buy and sell
app.post("/order", middleware, async (req, res) => {
  const { success, data } = CreateOrderSchema.safeParse(req.body); // response giving by user after zod validation
  const userId: string = req.userId; // from that middleware

  const originalOrderId = uuid();

  if (!success) {
    return res.status(411).json({ msg: "incorrect type" });
  }

  try {
    await prisma.$transaction(
      async (txn) => {
        // market
        const response = await txn.$queryRaw<{
          yesOrderbook: string;
          noOrderbook: string;
          id: string;
          totalQty: number;
        }>`SELECT * FROM "Market" WHERE id=${data.marketId} FOR UPDATE;`;

        //user
        const userResponse = await txn.$queryRaw<{
          id: string;
          address: string;
          usdBalance: number;
        }>`SELECT * FROM "User" WHERE id=${userId} FOR UPDATE`;

        if (
          !userResponse ||
          (Array.isArray(userResponse) && userResponse.length === 0)
        ) {
          throw new Error("User Not found");
        }

        if (!response || (Array.isArray(response) && response.length === 0)) {
          throw new Error("Market not found");
        }

        const yesOrderbook: Orderbook = JSON.parse(response.yesOrderbook);
        const noOrderbook: Orderbook = JSON.parse(response.noOrderbook);

        // for buy a yes
        if (data.side == "yes" && data.type == "buy") {
          // usd they have to spent
          const usd = data.qty * data.price;
          if (userResponse.usdBalance < usd) {
            res.status(403).json({
              msg: "insufficent balance",
            });
            return;
          }

          let leftQty = data.qty;

          const originalOrderId = uuid(); // genrate a random uuid

          const prices = Object.keys(yesOrderbook).sort(
            (a: string, b: string) => Number(a) - Number(b),
          );

          await Promise.all(
            prices.map(async (price) => {
              if (Number(price) > data.price) {
                return;
              }
              const { orders } = yesOrderbook[price]!;

              await Promise.all(
                orders.map(async (order) => {
                  const matchdQty = order.qty >= leftQty ? leftQty : order.qty;
                  const reverseOrder = order.reverseOrder;
                  if (!reverseOrder) {
                    await prisma.position.update({
                      where: {
                        userId_marketId_type: {
                          userId,
                          marketId: data.marketId,
                          type: "No",
                        },
                      },
                      data: {
                        qty: {
                          increment: matchdQty,
                        },
                      },
                    });

                    await prisma.user.update({
                      where: {
                        id: order.userId,
                      },
                      data: {
                        usdBalance: {
                          decrement: (100 - Number(price)) * matchdQty,
                        },
                      },
                    });
                  } else {
                  }

                  await prisma.position.update({
                    where: {
                      userId_marketId_type: {
                        userId,
                        marketId: data.marketId,
                        type: "Yes",
                      },
                    },
                    data: {
                      qty: {
                        decrement: matchdQty,
                      },
                    },
                  });

                  await prisma.user.update({
                    where: {
                      id: userId,
                    },
                    data: {
                      usdBalance: {
                        decrement: Number(price) * matchdQty,
                      },
                    },
                  });

                  leftQty -= matchdQty;
                  order.filledQty += matchdQty;
                  yesOrderbook[price]!.availableQty -= matchdQty; // update the yes order book that we can just shuv on the db
                }),
              );
            }),
          );

          if (leftQty) {
            // if we left with some qty in order book the we need to do this
            const oppositePrice = 100 - data.price;
            if (!noOrderbook[oppositePrice]) {
              noOrderbook[oppositePrice] = { availableQty: 0, orders: [] };
            }

            noOrderbook[oppositePrice]!.availableQty += leftQty;
            noOrderbook[oppositePrice]!.orders.push({
              userId,
              qty: leftQty,
              filledQty: 0,
              originalOrderId: originalOrderId,
              reverseOrder: true,
            });
          }
        }

        // for sell a yes
        if (data.side == "yes" && data.type == "sell") {
          const originalOrderId = uuid();
          const buyPrice = 100 - data.price;

          // check user have sufficient amount of yes on there accunt
          const userPosition = await prisma.position.findFirst({
            where: {
              userId: userId,
              marketId: data.marketId,
              type: "Yes",
            },
          });

          if (!userPosition?.qty) {
            return;
          }

          if (userPosition.qty < data.qty) {
            return;
          }

          let leftQty = data.qty;

          const prices = Object.keys(noOrderbook).sort(
            (a: string, b: string) => Number(a) - Number(b),
          );

          await Promise.all(
            prices.map(async (price) => {
              if (Number(price) > buyPrice) {
                return;
              }
              const { orders } = noOrderbook[price]!;

              await Promise.all(
                orders.map(async (order) => {
                  const matchdQty = order.qty >= leftQty ? leftQty : order.qty;
                  const reverseOrder = order.reverseOrder;
                  if (!reverseOrder) {
                    await prisma.position.update({
                      where: {
                        userId_marketId_type: {
                          userId,
                          marketId: data.marketId,
                          type: "Yes",
                        },
                      },
                      data: {
                        qty: {
                          increment: matchdQty,
                        },
                      },
                    });

                    await prisma.user.update({
                      where: {
                        id: order.userId,
                      },
                      data: {
                        usdBalance: {
                          decrement: (100 - Number(price)) * matchdQty,
                        },
                      },
                    });
                  }

                  await prisma.position.update({
                    where: {
                      userId_marketId_type: {
                        userId,
                        marketId: data.marketId,
                        type: "Yes",
                      },
                    },
                    data: {
                      qty: {
                        decrement: matchdQty,
                      },
                    },
                  });

                  await prisma.user.update({
                    where: {
                      id: userId,
                    },
                    data: {
                      usdBalance: {
                        increment: Number(price) * matchdQty,
                      },
                    },
                  });

                  leftQty -= matchdQty;
                  order.filledQty += matchdQty;
                  noOrderbook[price]!.availableQty -= matchdQty; // update the yes order book that we can just shuv on the db
                }),
              );
            }),
          );

          if (leftQty) {
            // if we left with some qty in order book the we need to do this
            const oppositePrice = 100 - data.price;
            if (!yesOrderbook[oppositePrice]) {
              yesOrderbook[oppositePrice] = { availableQty: 0, orders: [] };
            }

            yesOrderbook[oppositePrice]!.availableQty += leftQty;
            yesOrderbook[oppositePrice]!.orders.push({
              userId,
              qty: leftQty,
              filledQty: 0,
              originalOrderId: originalOrderId,
              reverseOrder: true,
            });
          }
        }

        if (data.side == "no" && data.type == "buy") {
        }

        if (data.side == "no" && data.type == "sell") {
        }

        await prisma.orderHistory.create({
            data: {
                id: originalOrderId,
                orderType: data.type === "buy" ?  "Buy" : "Sell",\
                userId,
                price: data.price,
                qty: data.qty,
                marketId: data.marketId
            }
        })

        await txn.market.update({
          data: {
            yesOrderbook: JSON.stringify(yesOrderbook),
            noOrderbook: JSON.stringify(noOrderbook),
          },
          where: {
            id: data.marketId,
          },
        });

        console.log("response", response);
      },
      { maxWait: 5000, timeout: 10000 }, // wait up to 5s and kill the txn if its run more then 10s
    );
    res.json({ msg: "Buy complete" });
  } catch (e) {
    res.status(500).json({
      msg: e instanceof Error ? e.message : "Transaction failed",
    });
  }
});

app.get("/markets", async (req, res) => {
  const markets = await prisma.market.findFirst({
    where: {
      id: req.query.marketId as string,
    },
  });
  res.json({
    markets,
  });
});

app.post("/split", middleware, async (req, res) => {
  const { data, success } = SplitSchema.safeParse(req.body);
  const userId: string = req.userId;
  const marketId = data?.marketId!

  if (!success) {
    res.status(411).json({
      msg: "incorrect input",
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    const userResponse = await tx.$queryRaw<
      {
        id: string;
        address: string;
        usdBalance: number;
      }[]
    >`SELECT * FROM "User" WHERE id=${userId} FOR UPDATE`;

    const user = userResponse[0];
    if (!user) {
      throw new Error("User Not found");
    }

    if (user.usdBalance < data?.amount) {
      res.status(403).json({
        msg: "sorry you are not allowed to do this",
      });
      return;
    }

    await tx.user.update({
      where: {
        id: userId,
      },
      data: {
        usdBalance: {
          decrement: data.amount,
        },
      },
    });

    // for yes
    await tx.position.upsert({
      where: {
        userId_marketId_type: {
          marketId,
          userId,
          type: "Yes",
        },
      },
      create: {
        marketId,
        userId,
        type: "Yes",
        qty: data.amount,
      },
      update: {
        qty: {
          increment: data.amount,
        },
      },
    });

    // for no
    await tx.position.upsert({
      where: {
        userId_marketId_type: {
          marketId,
          userId,
          type: "No",
        },
      },
      create: {
        marketId,
        userId,
        type: "No",
        qty: data.amount,
      },
      update: {
        qty: {
          increment: data.amount,
        },
      },
    });

    await prisma.orderHistory.create({
            data: {
                orderType: "Split",
                userId,
                price: 0,
                qty: data.amount,
                marketId: data.marketId
            }
        })

  });
});

app.post("/merge", middleware, async (req, res) => {
    const {data, success} = MergeSchema.safeParse(req.body);
    const userId: string = req.userId;
    if (!success) {
        res.status(411).json({message: "Incorrect inputs"});
        return 
    }
    const marketId = data?.marketId;

    try {
        await prisma.$transaction(async tx => {
            const userResponse = await tx.$queryRaw<{id: string, address: string, usdBalance: number}[]>`SELECT * FROM "User" WHERE id=${userId} FOR UPDATE;`;
            const user = userResponse[0];
            if (!user) {
                throw new Error("User not found");
            }
            
            const yesPosition = await tx.position.findFirst({
                where: {
                    userId,
                    marketId,
                    type: "Yes"
                }
            });

            const noPosition = await tx.position.findFirst({
                where: {
                    userId,
                    marketId,
                    type: "No"
                }
            });

            if (!yesPosition || yesPosition.qty < data.amount) {
                throw new Error("Insufficient Yes position");
            }

            if (!noPosition || noPosition.qty < data.amount) {
                throw new Error("Insufficient No position");
            }

            await tx.position.update({
                where: {
                    userId_marketId_type: {
                        userId,
                        marketId,
                        type: "Yes"
                    }
                },
                data: {
                    qty: {
                        decrement: data.amount
                    }
                }
            })

            await tx.position.update({
                where: {
                    userId_marketId_type: {
                        userId,
                        marketId,
                        type: "No"
                    }
                },
                data: {
                    qty: {
                        decrement: data.amount
                    }
                }
            })

            await tx.user.update({
                where: {
                    id: userId
                },
                data: {
                    usdBalance: {
                        increment: data.amount
                    }
                }
            })

            await prisma.orderHistory.create({
            data: {
                orderType: "Merge",
                userId,
                price: 0,
                qty: data.amount,
                marketId: data.marketId
            }
        })
        })
        res.json({
            message: "Merge successful"
        })
    } catch (error: any) {
        console.error("Error merging:", error);
        if (error.message === "Insufficient Yes position" || error.message === "Insufficient No position") {
            res.status(403).json({
                message: "Sorry you dont have enough position"
            })
        } else {
            res.status(500).json({
                message: "Error merging"
            })
        }
    }
})

app.get("/balance", middleware, (req, res) => {
    const userId = req.userId as string
    const user = await prisma.user.findFirst({
        where: {
            id: userId
        }
    })

    res.json({
        balance: user?.usdBalance
    })

});

app.get("/positions", middleware, async (req, res) => {
    const userId: string = req.userId as string;
    const positions = await prisma.position.findMany({
        where: {
            userId
        }
    })

    res.json({
        positions
    })
})

app.post("/history", middleware, async (req, res) => {
    const userId: string = req.userId as string;
    const history = await prisma.orderHistory.findMany({
        where: {
            userId
        }
    })

    res.json({
        history
    })
})

app.listen(3000);

// TODO: ADD BALANCE LOCKING , Matching system
