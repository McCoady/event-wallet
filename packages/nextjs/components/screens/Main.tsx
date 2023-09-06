import { useEffect, useState } from "react";
import { InputBase } from "../scaffold-eth";
import { BigNumber, ethers } from "ethers";
import { useAccount } from "wagmi";
import { BackwardIcon } from "@heroicons/react/24/outline";
import { TokenSwap } from "~~/components/TokenSwap";
import { BurnerSigner } from "~~/components/scaffold-eth/BurnerSigner";
import { TokenBalanceRow } from "~~/components/scaffold-eth/TokenBalanceRow";
import { useScaffoldContractRead } from "~~/hooks/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";
import { TTokenBalance, TTokenInfo } from "~~/types/wallet";
import { notification } from "~~/utils/scaffold-eth";
import { ContractName } from "~~/utils/scaffold-eth/contract";

/**
 * Main Screen
 */
export const Main = () => {
  const { address } = useAccount();
  const [processing, setProcessing] = useState(false);
  const [loadingCheckedIn, setLoadingCheckedIn] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);
  const [alias, setAlias] = useState("");
  const [swapToken, setSwapToken] = useState<TTokenInfo>(scaffoldConfig.tokens[1]);
  const [showSwap, setShowSwap] = useState(false);

  const message = {
    action: "user-checkin",
    address: address,
    alias: alias,
  };

  const { data: balanceSalt } = useScaffoldContractRead({
    contractName: "SaltToken",
    functionName: "balanceOf",
    args: [address],
  });

  const tokens = scaffoldConfig.tokens.slice(1);
  const tokensData: { [key: string]: TTokenBalance } = {};

  tokens.forEach(token => {
    tokensData[token.symbol] = {
      balance: BigNumber.from(0),
    };
    const contractName: ContractName = `${token.name}Token` as ContractName;
    const contractDexName: ContractName = `BasicDex${token.name}` as ContractName;
    // The tokens array should not change, so this should be safe. Anyway, we can refactor this later.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data: balance } = useScaffoldContractRead({
      contractName: contractName,
      functionName: "balanceOf",
      args: [address],
    });
    if (balance) {
      tokensData[token.symbol].balance = balance;
    }
    // The tokens array should not change, so this should be safe. Anyway, we can refactor this later.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data: price } = useScaffoldContractRead({
      contractName: contractDexName,
      functionName: "assetOutPrice",
      args: [ethers.utils.parseEther("1")],
    });
    if (price) {
      tokensData[token.symbol].price = price;
    }
    if (price && balance) {
      tokensData[token.symbol].value = price.mul(balance).div(ethers.utils.parseEther("1"));
    }
  });

  useEffect(() => {
    const updateCheckedIn = async () => {
      try {
        setLoadingCheckedIn(true);
        const response = await fetch(`/api/users/${address}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          setCheckedIn(true);
        }
      } catch (e) {
        console.log("Error checking if user is checked in", e);
      } finally {
        setLoadingCheckedIn(false);
      }
    };

    if (address) {
      updateCheckedIn();
    }
  }, [address]);

  const handleSignature = async ({ signature }: { signature: string }) => {
    setProcessing(true);
    if (!address || !alias) {
      setProcessing(false);
      return;
    }

    try {
      // Post the signed message to the API
      const response = await fetch("/api/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ signature, signerAddress: address, alias: alias }),
      });

      if (response.ok) {
        setCheckedIn(true);
        notification.success("Checked in!");
      } else {
        const result = await response.json();
        notification.error(result.error);
      }
    } catch (e) {
      console.log("Error checking in the user", e);
    } finally {
      setProcessing(false);
    }
  };

  const handleShowSwap = (selectedToken: TTokenInfo) => {
    console.log("selectedToken emoji: ", selectedToken.emoji);
    setSwapToken(selectedToken);
    setShowSwap(true);
  };

  return (
    <>
      <div className="flex flex-col gap-2 max-w-[400px] text-center m-auto">
        <p className="font-bold">Welcome to {scaffoldConfig.eventName}!</p>

        {!checkedIn && !loadingCheckedIn && (
          <div>
            <div>
              <InputBase
                value={alias}
                onChange={v => {
                  setAlias(v);
                }}
                placeholder={alias ? alias : "Username"}
              />
            </div>

            <BurnerSigner
              className={`btn btn-primary w-full mt-4 ${processing || loadingCheckedIn ? "loading" : ""}`}
              disabled={processing || loadingCheckedIn || checkedIn}
              message={message}
              handleSignature={handleSignature}
            >
              {loadingCheckedIn ? "..." : checkedIn ? "Checked-in" : "Check-in"}
            </BurnerSigner>
          </div>
        )}

        {checkedIn && !showSwap && (
          <div className="bg-base-300 rounded-xl">
            <table className="table-auto border-separate border-spacing-4">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Price</th>
                  <th>Balance</th>
                  <th>Value</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tokens.map(token => (
                  <TokenBalanceRow
                    key={token.symbol}
                    tokenInfo={token}
                    tokenBalance={tokensData[token.symbol]}
                    handleShowSwap={handleShowSwap}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {checkedIn && showSwap && (
          <div className="bg-base-300 rounded-xl p-4">
            <button className="btn btn-primary" onClick={() => setShowSwap(false)}>
              <BackwardIcon className="h-5 w-5 mr-2" /> Go Back
            </button>
            <TokenSwap
              token={swapToken.contractName as ContractName}
              defaultAmountOut={"1"}
              defaultAmountIn={ethers.utils.formatEther(
                tokensData[swapToken.symbol].price.sub(tokensData[swapToken.symbol].price.mod(1e14)).add(1e14),
              )}
              balanceSalt={balanceSalt}
              balanceToken={tokensData[swapToken.symbol].balance}
              close={() => setShowSwap(false)}
            />
          </div>
        )}
      </div>
    </>
  );
};
