import { t } from "localise-ai-sdk";
import React from "react";
import { Text, View } from "react-native";

export default function TestComponent() {
  const age: number = 10;
  const count: number = 1;
  const files: number = 5;
  return (
    <View>
      <Text>{t("test.testcomponent.text_1")}</Text>
      <Text>{t("test.testcomponent.text_2")}</Text>
      <Text>{t("test.testcomponent.text_3", { age: age })}</Text>
      <Text>{t("test.testcomponent.text_4", { count: count })}</Text>
      <Text>{t("test.testcomponent.text_5", { count: count })}</Text>
      <Text>
        {t("test.testcomponent.text_6", { count: count })}
        {t("test.testcomponent.text_7")}{" "}
        {t("test.testcomponent.text_8", { files: files })}
      </Text>
    </View>
  );
}
